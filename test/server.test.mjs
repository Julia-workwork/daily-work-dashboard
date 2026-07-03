import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createAppServer, resolveListenHost, isDirectRun } from "../server.mjs";

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
      tasks: [["Task Name", "Priority", "Status", "Due Date"], ["A", "P1", "In Progress", "2026-06-17"]],
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

test("GET /api/workflow prefers Notion when Daily Work is configured", async () => {
  const calls = [];
  const server = createAppServer({
    notionToken: "secret-token",
    notionDailyWorkPageId: "daily-page",
    notionTasksDataSourceId: "tasks-source",
    fetchNotionSource: async (options) => {
      calls.push(options);
      return {
        dailyExtracts: [["Date"], ["2026-06-22"]],
        tasks: [["Task Name", "Priority", "Status"], ["From Notion", "P1", "In Progress"]],
        weeklyReview: [["Week Range", "Draft Weekly Report"], ["2026.06.22-2026.06.27", "Notion weekly report"]],
        categorySummary: [["Category", "Open Tasks"], ["Content", "1"]],
        settings: [["Type", "Value"], ["Priority", "P1"]],
        source: { kind: "notion", month: "2026-06" },
      };
    },
    fetchTabs: async () => {
      throw new Error("Should not read Google Sheet when Notion is configured");
    },
    today: "2026-06-22",
  });

  const response = await request(server, "/api/workflow");
  const payload = response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.source.kind, "notion");
  assert.equal(payload.tasks[0].taskName, "From Notion");
  assert.equal(payload.weeklyReview.draftWeeklyReport, "Notion weekly report");
  assert.equal(calls[0].dailyWorkPageId, "daily-page");
  assert.equal(calls[0].tasksDataSourceId, "tasks-source");
});

test("GET /api/workflow reuses a recent Notion sync for repeated page loads", async () => {
  let calls = 0;
  const server = createAppServer({
    notionToken: "secret-token",
    notionDailyWorkPageId: "daily-page",
    notionTasksDataSourceId: "tasks-source",
    fetchNotionSource: async () => {
      calls += 1;
      return {
        dailyExtracts: [["Date"], ["2026-06-22"]],
        tasks: [["Task Name", "Priority", "Status"], [`From Notion ${calls}`, "P1", "In Progress"]],
        weeklyReview: [["Week Range", "Draft Weekly Report"], ["2026.06.22-2026.06.27", "Notion weekly report"]],
        categorySummary: [["Category", "Open Tasks"], ["Content", "1"]],
        settings: [["Type", "Value"], ["Priority", "P1"]],
        source: { kind: "notion", month: "2026-06" },
      };
    },
    today: "2026-06-22",
  });

  const first = await request(server, "/api/workflow");
  const second = await request(server, "/api/workflow");

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls, 1);
  assert.equal(first.json().tasks[0].taskName, "From Notion 1");
  assert.equal(second.json().tasks[0].taskName, "From Notion 1");
});

test("GET /api/workflow refresh query bypasses the recent sync cache", async () => {
  let calls = 0;
  const server = createAppServer({
    notionToken: "secret-token",
    notionDailyWorkPageId: "daily-page",
    notionTasksDataSourceId: "tasks-source",
    fetchNotionSource: async () => {
      calls += 1;
      return {
        dailyExtracts: [["Date"], ["2026-06-22"]],
        tasks: [["Task Name", "Priority", "Status"], [`From Notion ${calls}`, "P1", "In Progress"]],
        weeklyReview: [["Week Range", "Draft Weekly Report"], ["2026.06.22-2026.06.27", "Notion weekly report"]],
        categorySummary: [["Category", "Open Tasks"], ["Content", "1"]],
        settings: [["Type", "Value"], ["Priority", "P1"]],
        source: { kind: "notion", month: "2026-06" },
      };
    },
    today: "2026-06-22",
  });

  const first = await request(server, "/api/workflow");
  const second = await request(server, "/api/workflow?refresh=1");

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls, 2);
  assert.equal(first.json().tasks[0].taskName, "From Notion 1");
  assert.equal(second.json().tasks[0].taskName, "From Notion 2");
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
      return { id: "new-task-page", url: "https://notion.so/task-row" };
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
  assert.equal(payload.sourceId, "new-task-page");
  assert.equal(payload.sourceType, "workflow-task");
  assert.equal(payload.notionUrl, "https://notion.so/task-row");
  assert.equal(calls[0].token, "secret-token");
  assert.equal(calls[0].dataSourceId, "collection://abc123");
  assert.equal(calls[0].task.taskName, "剪辑 H1 Call Log 视频");
});

test("PATCH /api/notion/tasks updates an existing Workflow Tasks row", async () => {
  const calls = [];
  const server = createAppServer({
    notionToken: "secret-token",
    updateNotionTask: async (options) => {
      calls.push(options);
      return { url: "https://notion.so/task-row" };
    },
  });

  const response = await request(server, "/api/notion/tasks", {
    method: "PATCH",
    body: JSON.stringify({
      sourceId: "task-page-id",
      taskName: "Updated task",
      status: "Done",
      priority: "P1",
      category: "Product",
      dueDate: "2026-06-22",
      nextAction: "Done",
      needsReview: false,
    }),
  });
  const payload = response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(calls[0].pageId, "task-page-id");
  assert.equal(calls[0].task.taskName, "Updated task");
});

test("PATCH /api/notion/tasks returns the real API validation error", async () => {
  const server = createAppServer({
    notionToken: "secret-token",
  });

  const response = await request(server, "/api/notion/tasks", {
    method: "PATCH",
    body: JSON.stringify({
      taskName: "Missing page id",
      status: "Done",
    }),
  });
  const payload = response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Notion task page id is required.");
});

test("PATCH /api/notion/daily-work updates an editable Daily Work source record", async () => {
  const calls = [];
  const server = createAppServer({
    notionToken: "secret-token",
    updateDailyWorkTodo: async (options) => {
      calls.push(options);
      return { id: "todo-block" };
    },
  });

  const response = await request(server, "/api/notion/daily-work", {
    method: "PATCH",
    body: JSON.stringify({
      sourceId: "todo-block",
      taskName: "[PL] Updated daily item",
      status: "Done",
    }),
  });
  const payload = response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(calls[0].blockId, "todo-block");
  assert.equal(calls[0].task.taskName, "[PL] Updated daily item");
});

test("isDirectRun handles file paths with spaces", () => {
  assert.equal(
    isDirectRun("file:///Users/Zhuanz/Documents/New%20project/daily-work-dashboard/server.mjs", "/Users/Zhuanz/Documents/New project/daily-work-dashboard/server.mjs"),
    true,
  );
});

test("resolveListenHost binds production deployments to all interfaces", () => {
  assert.equal(resolveListenHost({ RENDER: "true" }), "0.0.0.0");
  assert.equal(resolveListenHost({ NODE_ENV: "production" }), "0.0.0.0");
  assert.equal(resolveListenHost({ HOST: "127.0.0.1", RENDER: "true" }), "127.0.0.1");
  assert.equal(resolveListenHost({}), "127.0.0.1");
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
