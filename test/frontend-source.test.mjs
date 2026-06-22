import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("frontend does not derive class attributes directly from sheet priority values", async () => {
  const source = await read("../static/app.js");

  assert.doesNotMatch(source, /priority-\$\{String\(task\.priority\)/);
  assert.match(source, /priorityClass/);
});

test("task table keeps horizontal scrolling available outside mobile breakpoints", async () => {
  const source = await read("../static/styles.css");
  const tablePanelBlock = source.match(/\.table-panel\s*\{[^}]+\}/)?.[0] || "";

  assert.match(tablePanelBlock, /overflow-x:\s*auto/);
});

test("HTML shell uses English Action Zine navigation labels", async () => {
  const html = await read("../static/index.html");

  assert.match(html, /lang="en"/);
  assert.match(html, /Daily Work/);
  assert.match(html, /Overview/);
  assert.match(html, /Tasks/);
  assert.match(html, /Weekly/);
  assert.match(html, /Settings/);
  assert.doesNotMatch(html, /总览|任务|周报|设置|正在/);
});

test("browser source contains required Action Zine English labels", async () => {
  const source = `${await read("../static/index.html")}\n${await read("../static/app.js")}`;

  for (const label of [
    "Julia's Workflow System",
    "Daily Work",
    "Command Center",
    "Today's Focus",
    "Latest Notes",
    "Weekly Draft",
    "New Task",
    "Save to Notion",
    "Saved to Workflow Tasks",
    "Kept as local draft",
    "Monthly Report",
    "Leadership Weekly Report",
    "Source records remain read-only",
    "本周完成",
    "量化产出",
    "下周计划",
    "View all tasks",
    "Open draft",
    "Syncing work records...",
    "No high-impact tasks for now.",
    "Private Access",
    "Unlock Dashboard",
    "/api/auth/login",
    "/api/auth/status",
  ]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(source, /READ-ONLY|NOTION SOURCE|GOOGLE SHEET/);
  assert.doesNotMatch(source, /删除 Notion|deleteNotion|removeSource|clearSource/);
});

test("task and weekly hero sections are centered", async () => {
  const source = await read("../static/styles.css");
  const pageKickerBlock = source.match(/\.page-kicker\s*\{[^}]+\}/)?.[0] || "";

  assert.match(pageKickerBlock, /text-align:\s*center/);
  assert.match(pageKickerBlock, /justify-items:\s*center/);
});

test("auth panel keeps a dark readable background without relying on body state", async () => {
  const source = await read("../static/styles.css");
  const authPanelBlock = source.match(/\.auth-panel\s*\{[^}]+\}/)?.[0] || "";
  const authCardBlock = source.match(/\.auth-card\s*\{[^}]+\}/)?.[0] || "";

  assert.match(authPanelBlock, /#050505/);
  assert.match(authCardBlock, /rgba\(10,\s*10,\s*12,\s*0\.78\)/);
});

test("auth panel hidden attribute overrides its grid display", async () => {
  const source = await read("../static/styles.css");
  const hiddenAuthPanelBlock = source.match(/\.auth-panel\[hidden\]\s*\{[^}]+\}/)?.[0] || "";

  assert.match(hiddenAuthPanelBlock, /display:\s*none\s*!important/);
});
