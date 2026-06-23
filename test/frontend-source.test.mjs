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
    "Product Line",
    "Brand",
    "IMC",
    "Julia’s Initiative",
    "Next Moves",
    "[TBD]",
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

test("weekly report renders one selected week with a week filter", async () => {
  const source = await read("../static/app.js");
  const renderWeeklyBlock = source.match(/function renderWeekly\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(source, /data-week-filter/);
  assert.match(source, /selectedWeeklyReport/);
  assert.match(renderWeeklyBlock, /weeklyLeadershipCard\(selectedReport/);
  assert.doesNotMatch(renderWeeklyBlock, /monthly\.weeks\.map\(weeklyLeadershipCard\)/);
});

test("weekly report uses Julia workflow sections instead of generic report buckets", async () => {
  const source = await read("../static/app.js");

  for (const label of ["Product Line", "Brand", "IMC", "Julia’s Initiative", "Next Moves", "[TBD]"]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const oldLabel of ["量化产出", "跨部门协作", "待协调事项"]) {
    assert.doesNotMatch(source, new RegExp(oldLabel));
  }
});

test("weekly report strips escaped Notion tags without leaving slashes", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /replace\(\/\\\\\?\\\[[^/]+\\\\\?\\\]\\s\*\/g/);
  assert.match(source, /replace\(\/\^\\\\\+\/,\s*""\)/);
});

test("weekly page includes a monthly recap before the selected weekly report", async () => {
  const source = await read("../static/app.js");
  const renderWeeklyBlock = source.match(/function renderWeekly\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(source, /monthlyRecapCard/);
  assert.match(source, /Monthly Recap/);
  assert.match(renderWeeklyBlock, /monthlyRecapCard\(monthly\)/);
  assert.match(renderWeeklyBlock, /weeklyLeadershipCard\(selectedReport/);
});

test("monthly recap shows every concrete item in collapsible lists", async () => {
  const source = await read("../static/app.js");
  const monthlyRecapBlock = source.match(/function monthlyRecapCard\(monthly\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(monthlyRecapBlock, /<details class="monthly-recap-item"/);
  assert.match(monthlyRecapBlock, /<summary>/);
  assert.match(monthlyRecapBlock, /monthly-recap-list/);
  assert.match(monthlyRecapBlock, /section\.items\.map/);
  assert.match(monthlyRecapBlock, /<li>\$\{escapeHtml\(item\)\}<\/li>/);
  assert.doesNotMatch(monthlyRecapBlock, /section\.items\[0\]/);
  assert.doesNotMatch(source, /weekSections\.flatMap\(\(section\) => section\.items\)\)\.slice\(0,\s*3\)/);
});
