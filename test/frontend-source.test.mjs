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
    "Focus Items",
    "This Week Ongoing",
    "Daily Records",
    "Weekly Draft",
    "Workload Estimate",
    "Records",
    "Quantified Output",
    "Edit Task",
    "Report Week",
    "New Task",
    "Save to Notion",
    "Saved to Workflow Tasks",
    "Kept as local draft",
    "Monthly Report",
    "Leadership Weekly Report",
    "Daily Work todo records and Workflow Tasks rows can be edited",
    "Product Line",
    "Brand",
    "IMC",
    "Julia’s Initiative",
    "Next Moves",
    "[TBD]",
    "Tag Guide",
    "[PL]",
    "[BR]",
    "[JL]",
    "[DA]",
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

  for (const label of ["Product Line", "Brand", "IMC", "Executive Summary", "Cross-functional Progress", "Quantified Output", "In Progress", "Waiting / TBD", "[TBD]"]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const oldLabel of ["量化产出", "跨部门协作", "待协调事项"]) {
    assert.doesNotMatch(source, new RegExp(oldLabel));
  }
});

test("weekly report keeps each business line as the primary grouping", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /weeklyExecutiveSummary/);
  assert.match(source, /lineSummaryText/);
  assert.match(source, /weeklyLineSection/);
  assert.match(source, /line\.quantifiedItems/);
  assert.match(source, /line\.progressItems/);
  assert.match(source, /line\.waitingItems/);
  assert.match(source, /Cross-functional Progress/);
});

test("weekly executive summary includes all line items instead of samples", async () => {
  const source = await read("../static/app.js");
  const lineReportBlock = source.match(/function lineReport\(line, items\)\s*\{[\s\S]+?\n\}/)?.[0] || "";
  const lineSummaryBlock = source.match(/function lineSummaryText\(title, details\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(lineSummaryBlock, /Key Completed Work/);
  assert.match(lineSummaryBlock, /In Progress/);
  assert.match(lineSummaryBlock, /Waiting \/ TBD/);
  assert.match(lineSummaryBlock, /formatSummaryList/);
  assert.doesNotMatch(lineReportBlock, /\.slice\(0,\s*6\)/);
  assert.doesNotMatch(lineReportBlock, /compactItems/);
});

test("weekly executive summary can be edited in place", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /editableExecutiveSummary/);
  assert.match(source, /bindExecutiveSummaryEditor/);
  assert.match(source, /data-summary-line/);
  assert.match(source, /data-save-summary/);
  assert.match(source, /localStorage\.setItem/);
  assert.doesNotMatch(source, /Editable Weekly Draft/);
});

test("weekly report recognizes short workflow tag aliases", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /WORKFLOW_TAG_GROUPS/);
  for (const alias of ["PL", "BR", "UI", "CT", "JL", "ID", "PN", "DA", "TBD"]) {
    assert.match(source, new RegExp(`"${alias}"`));
  }

  assert.match(source, /workflowTagGuide/);
  assert.match(source, /Tag Guide/);
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

  assert.match(monthlyRecapBlock, /Records/);
  assert.match(monthlyRecapBlock, /Quantified Output/);
  assert.match(monthlyRecapBlock, /Ongoing Projects/);
  assert.match(monthlyRecapBlock, /Leadership Summary/);
  assert.match(monthlyRecapBlock, /Quantified Output Details/);
  assert.match(monthlyRecapBlock, /monthly-recap-metrics/);
  assert.match(monthlyRecapBlock, /monthly-summary-panel/);
  assert.match(monthlyRecapBlock, /monthly-recap-list/);
  assert.match(monthlyRecapBlock, /list\(recap\.ongoingProjects/);
  assert.match(monthlyRecapBlock, /list\(recap\.leadershipSummary/);
  assert.match(monthlyRecapBlock, /<li>\$\{escapeHtml\(item\)\}<\/li>/);
  assert.doesNotMatch(source, /weekSections\.flatMap\(\(section\) => section\.items\)\)\.slice\(0,\s*3\)/);
});

test("frontend supports editing tasks and source records", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /data-edit-task/);
  assert.match(source, /data-inline-field/);
  assert.match(source, /bindInlineTaskControls/);
  assert.match(source, /saveTaskEdit/);
  assert.match(source, /\/api\/notion\/daily-work/);
  assert.match(source, /\/api\/notion\/tasks/);
  assert.match(source, /name="taskName"/);
});

test("tasks page supports week filtering and cleaned tag display", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /week:\s*"All"/);
  assert.match(source, /filterWeekSelect/);
  assert.match(source, /canonicalWeekLabel/);
  assert.match(source, /reportWeekLabel/);
  assert.match(source, /state\.filters\.week/);
  assert.match(source, /cleanTaskText/);
  assert.match(source, /displayReportText\(text\)/);
});

test("weekly report uses one normalized week label format", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /parseWeekRangeLabel/);
  assert.match(source, /reportWeekLabel\(data,\s*date\)/);
  assert.doesNotMatch(source, /week:\s*weekLabel\(date\)/);
});

test("task table presents direct inline editing controls", async () => {
  const source = await read("../static/app.js");
  const styles = await read("../static/styles.css");

  assert.match(source, /data-inline-field="\$\{field\}"/);
  assert.match(source, /direct-edit-cell/);
  assert.match(styles, /\.direct-edit-cell/);
  assert.match(styles, /\.inline-task-select/);
});

test("weekly and monthly reporting exposes quantified output details", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /explicitQuantity/);
  assert.match(source, /quantifiedItems/);
  assert.match(source, /Workload Estimate/);
  assert.match(source, /Records/);
  assert.match(source, /Quantified Output/);
});

test("overview separates weekly ongoing work from daily records", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /weeklyOngoingItems/);
  assert.match(source, /dailyRecordGroups/);
  assert.match(source, /This Week Ongoing/);
  assert.match(source, /Daily Records/);
  assert.match(source, /<details class="daily-record-group"/);
});
