import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildDashboard, DEFAULT_SPREADSHEET_ID } from "./lib/workflow-domain.mjs";
import { fetchWorkflowTabs, workflowSource } from "./lib/google-sheets.mjs";
import { createNotionTask as createTaskInNotion } from "./lib/notion-tasks.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const staticRoot = join(root, "static");
const port = Number(process.env.PORT || 5175);
const host = resolveListenHost(process.env);
const DEFAULT_NOTION_TASKS_DATA_SOURCE_ID = "386cbc99-c1ab-8042-a401-000bc1689dd9";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), "application/json; charset=utf-8");
}

function sendJsonWithHeaders(res, status, body, headers) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function clean(value) {
  return String(value ?? "").trim();
}

function sessionValue(password) {
  return createHash("sha256").update(`daily-work-dashboard:${password}`).digest("hex");
}

function cookieValue(req, name) {
  const cookieHeader = req.headers.cookie || req.headers.Cookie || "";
  return String(cookieHeader)
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function isAuthenticated(req, password) {
  if (!password) return true;
  return cookieValue(req, "dashboard_session") === sessionValue(password);
}

function authCookie(password) {
  return [
    `dashboard_session=${sessionValue(password)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000",
  ].join("; ");
}

async function readSafeStatic(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw Object.assign(new Error("Bad request"), { statusCode: 400 });
  }

  const safePath = normalize(decodedPath).replace(/^[/\\]+/, "");
  const filePath = join(staticRoot, safePath);
  const relativePath = relative(staticRoot, filePath);

  if (relativePath.startsWith("..") || relativePath === "" || relativePath.includes("..")) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }

  return { filePath, content: await readFile(filePath) };
}

export function createAppServer(options = {}) {
  const fetchTabs = options.fetchTabs || fetchWorkflowTabs;
  const createNotionTask = options.createNotionTask || createTaskInNotion;
  const spreadsheetId = options.spreadsheetId || process.env.WORKFLOW_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  const notionToken = options.notionToken ?? process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? "";
  const notionTasksDataSourceId =
    options.notionTasksDataSourceId || process.env.NOTION_TASKS_DATA_SOURCE_ID || DEFAULT_NOTION_TASKS_DATA_SOURCE_ID;
  const dashboardPassword = clean(options.dashboardPassword ?? process.env.DASHBOARD_PASSWORD ?? "");
  const today = options.today;

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

      if (url.pathname === "/api/auth/status") {
        sendJson(res, 200, {
          authRequired: Boolean(dashboardPassword),
          authenticated: isAuthenticated(req, dashboardPassword),
        });
        return;
      }

      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        const body = await readJsonBody(req);
        if (clean(body.password) !== dashboardPassword) {
          sendJson(res, 401, { ok: false, error: "Incorrect password" });
          return;
        }
        sendJsonWithHeaders(res, 200, { ok: true }, { "Set-Cookie": authCookie(dashboardPassword) });
        return;
      }

      if (url.pathname === "/api/workflow") {
        if (!isAuthenticated(req, dashboardPassword)) {
          sendJson(res, 401, { authRequired: true, error: "Password required" });
          return;
        }
        const rawTabs = await fetchTabs({ spreadsheetId });
        const payload = buildDashboard(rawTabs, {
          today,
          ...workflowSource({ spreadsheetId }),
        });
        sendJson(res, 200, payload);
        return;
      }

      if (url.pathname === "/api/notion/tasks" && req.method === "POST") {
        if (!isAuthenticated(req, dashboardPassword)) {
          sendJson(res, 401, { authRequired: true, error: "Password required" });
          return;
        }
        const task = await readJsonBody(req);
        const result = await createNotionTask({
          token: notionToken,
          dataSourceId: notionTasksDataSourceId,
          task,
        });
        sendJson(res, 201, {
          ok: true,
          notionUrl: result.url,
          task,
        });
        return;
      }

      const requested = url.pathname === "/" ? "/index.html" : url.pathname;
      const { filePath, content } = await readSafeStatic(requested);
      send(res, 200, content, mimeTypes[extname(filePath)] || "application/octet-stream");
    } catch (error) {
      if (error && typeof error === "object" && error.statusCode === 400) {
        send(res, 400, "Bad request");
        return;
      }

      if (error && typeof error === "object" && error.statusCode === 403) {
        send(res, 403, "Forbidden");
        return;
      }

      if (error && typeof error === "object" && ["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)) {
        send(res, 404, "Not found");
        return;
      }

      sendJson(res, error && typeof error === "object" && error.statusCode ? error.statusCode : 500, {
        error: error instanceof Error ? error.message : "Unknown server error",
      });
    }
  });
}

export function resolveListenHost(env = process.env) {
  if (env.HOST) return env.HOST;
  if (env.RENDER || env.NODE_ENV === "production") return "0.0.0.0";
  return "127.0.0.1";
}

export function isDirectRun(moduleUrl, argvPath) {
  return Boolean(argvPath) && moduleUrl === pathToFileURL(argvPath).href;
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  createAppServer().listen(port, host, () => {
    console.log(`Daily Work Dashboard running at http://${host}:${port}/`);
  });
}
