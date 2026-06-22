import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createAppServer, isDirectRun } from "../server.mjs";

function request(server, url, options = {}) {
  const req = new EventEmitter();
  req.url = url;
  req.method = options.method || "GET";
  req.headers = { host: "127.0.0.1", ...(options.headers || {}) };

  const promise = new Promise((resolve) => {
    const res = {
      statusCode: 0,
      headers: {},
      writeHead(statusCode, headers) {
        this.statusCode = statusCode;
        this.headers = headers;
      },
      end(body = "") {
        resolve({
          status: this.statusCode,
          headers: this.headers,
          body: String(body),
          json: () => JSON.parse(String(body)),
        });
      },
    };

    server.emit("request", req, res);
  });

  if (options.body) req.emit("data", options.body);
  req.emit("end");
  return promise;
}

test("GET /api/workflow returns dashboard JSON", async () => {
  const server = createAppServer({
    fetchTabs: async () => ({
      dailyExtracts: [["Date"], ["2026-06-17"]],
      tasks: [["Task Name", "Priority", "Status"], ["A", "P1", "In Progress"]],
      weeklyReview: [["Week Range", "Draft Weekly Report"], ["2026.06.15-2026.06.18", "周报"]],
      categorySummary: [["Category", "Open Tasks"], ["Content Publishing", "1"]],
      settings: [["Type", "Value"], ["Priority", "P1"]],
    }),
    today: "2026-06-17",
  });

  const response = await request(server, "/api/workflow");
  const payload = response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.tasks[0].taskName, "A");
  assert.equal(payload.todayFocus.length, 1);
  assert.equal(payload.weeklyReview.draftWeeklyReport, "周报");
});

test("GET /api/workflow returns JSON error on fetch failure", async () => {
  const server = createAppServer({
    fetchTabs: async () => {
      throw new Error("Google Sheet tab is not readable");
    },
  });

  const response = await request(server, "/api/workflow");
  const payload = response.json();

  assert.equal(response.status, 500);
  assert.match(payload.error, /Google Sheet tab/);
});

test("password protection blocks workflow API when dashboard password is configured", async () => {
  const server = createAppServer({
    dashboardPassword: "open-sesame",
    fetchTabs: async () => {
      throw new Error("Should not fetch protected data");
    },
  });

  const response = await request(server, "/api/workflow");
  const payload = response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.authRequired, true);
});

test("POST /api/auth/login returns a dashboard session cookie for the correct password", async () => {
  const server = createAppServer({
    dashboardPassword: "open-sesame",
  });

  const response = await request(server, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password: "open-sesame" }),
  });
  const payload = response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.match(response.headers["Set-Cookie"], /dashboard_session=/);
  assert.match(response.headers["Set-Cookie"], /HttpOnly/);
});

test("GET /api/workflow allows access with a valid dashboard session cookie", async () => {
  const server = createAppServer({
    dashboardPassword: "open-sesame",
    fetchTabs: async () => ({
      dailyExtracts: [["Date"], ["2026-06-17"]],
      tasks: [["Task Name", "Priority", "Status"], ["A", "P1", "In Progress"]],
      weeklyReview: [["Week Range", "Draft Weekly Report"], ["2026.06.15-2026.06.18", "周报"]],
      categorySummary: [["Category", "Open Tasks"], ["Content Publishing", "1"]],
      settings: [["Type", "Value"], ["Priority", "P1"]],
    }),
    today: "2026-06-17",
  });

  const login = await request(server, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password: "open-sesame" }),
  });
  const cookie = login.headers["Set-Cookie"].split(";")[0];
  const response = await request(server, "/api/workflow", {
    headers: { cookie },
  });
  const payload = response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.tasks[0].taskName, "A");
});

test("POST /api/notion/tasks returns clear error when Notion token is missing", async () => {
  const server = createAppServer({
    notionToken: "",
    notionTasksDataSourceId: "collection://abc123",
  });

  const response = await request(server, "/api/notion/tasks", {
    method: "POST",
    body: JSON.stringify({ taskName: "A", nextAction: "B" }),
  });
  const payload = response.json();

  assert.equal(response.status, 503);
  assert.match(payload.error, /Notion token/);
});

test("POST /api/notion/tasks creates a Notion task through configured writer", async () => {
  const calls = [];
  const server = createAppServer({
    notionToken: "secret-token",
    notionTasksDataSourceId: "collection://abc123",
    createNotionTask: async (options) => {
      calls.push(options);
      return { url: "https://notion.so/task-row" };
    },
  });

  const response = await request(server, "/api/notion/tasks", {
    method: "POST",
    body: JSON.stringify({
      taskName: "剪辑 H1 Call Log 视频",
      status: "In Progress",
      priority: "P1",
      category: "Content",
      dueDate: "2026-06-22",
      nextAction: "检查字幕",
      needsReview: true,
    }),
  });
  const payload = response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.notionUrl, "https://notion.so/task-row");
  assert.equal(calls[0].token, "secret-token");
  assert.equal(calls[0].dataSourceId, "collection://abc123");
  assert.equal(calls[0].task.taskName, "剪辑 H1 Call Log 视频");
});

test("isDirectRun handles file paths with spaces", () => {
  assert.equal(
    isDirectRun("file:///Users/Zhuanz/Documents/New%20project/daily-work-dashboard/server.mjs", "/Users/Zhuanz/Documents/New project/daily-work-dashboard/server.mjs"),
    true,
  );
});

test("static file serving maps root to index.html", async () => {
  const server = createAppServer();

  const response = await request(server, "/");

  assert.equal(response.status, 200);
  assert.match(response.headers["Content-Type"], /text\/html/);
  assert.match(response.body, /Daily Work/);
  assert.match(response.body, /Overview/);
});

test("static file serving returns JavaScript MIME", async () => {
  const server = createAppServer();

  const response = await request(server, "/app.js");

  assert.equal(response.status, 200);
  assert.match(response.headers["Content-Type"], /text\/javascript/);
});

test("static file serving returns 400 for malformed paths", async () => {
  const server = createAppServer();

  const response = await request(server, "/%E0%A4%A");

  assert.equal(response.status, 400);
});

test("static file serving returns 404 for missing files", async () => {
  const server = createAppServer();

  const response = await request(server, "/missing-file.css");

  assert.equal(response.status, 404);
});

test("static file serving returns 404 for paths below files", async () => {
  const server = createAppServer();

  const response = await request(server, "/app.js/extra");

  assert.equal(response.status, 404);
});

test("static file serving returns 404 for directory requests", async () => {
  const server = createAppServer();

  const response = await request(server, "/assets");

  assert.equal(response.status, 404);
});
