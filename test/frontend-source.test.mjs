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
  assert.match(lineSummaryBlock, /summarizeReportItems/);
  assert.doesNotMatch(lineReportBlock, /\.slice\(0,\s*6\)/);
  assert.doesNotMatch(lineReportBlock, /compactItems/);
});

test("weekly executive summary cleans and groups raw records before display", async () => {
  const source = await read("../static/app.js");
  const lineReportBlock = source.match(/function lineReport\(line, items\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(source, /cleanSummaryText/);
  assert.match(source, /isStandaloneSummaryNoise/);
  assert.match(source, /summaryThemeLabel/);
  assert.match(source, /summarizeReportItems/);
  assert.match(source, /Message \/ SMS function/);
  assert.match(source, /User issues \/ feedback/);
  assert.match(source, /Content \/ assets/);
  assert.match(source, /Requirement management/);
  assert.match(source, /https\?:/);
  assert.match(lineReportBlock, /!isWaitingOrTbdItem\(item\)/);
});

test("weekly executive summary formats grouped records as readable bullets", async () => {
  const source = await read("../static/app.js");
  const summaryBlock = source.match(/function summarizeReportItems\(items, emptyText\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(summaryBlock, /recordCountLabel/);
  assert.match(summaryBlock, /values\.map\(\(value\) => `- \$\{value\}`\)/);
  assert.match(summaryBlock, /\\n\\n/);
  assert.doesNotMatch(summaryBlock, / - \$\{values\.join/);
});

test("weekly executive summary can be edited in place", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /editableExecutiveSummary/);
  assert.match(source, /summaryFieldValue/);
  assert.match(source, /bindExecutiveSummaryEditor/);
  assert.match(source, /data-summary-field/);
  assert.match(source, /data-save-summary/);
  assert.match(source, /localStorage\.setItem/);
  assert.doesNotMatch(source, /Editable Weekly Draft/);
});

test("weekly executive summary separates editable sections visually", async () => {
  const source = await read("../static/app.js");
  const editableSummaryBlock = source.match(/function editableExecutiveSummary\(report\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  for (const label of ["Overview", "Key Completed Work", "In Progress", "Waiting / TBD"]) {
    assert.match(editableSummaryBlock, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(editableSummaryBlock, /summary-edit-field/);
  assert.match(editableSummaryBlock, /data-summary-field/);
  for (const field of ['id: "overview"', 'id: "completed"', 'id: "progress"', 'id: "waiting"']) {
    assert.match(editableSummaryBlock, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
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

  assert.match(source, /replace\(\s*\/\\\\\+\\\[\/g,\s*"\["\s*\)/);
  assert.match(source, /replace\(\s*\/\\\\\+\\\]\/g,\s*"\]"\s*\)/);
  assert.match(source, /replace\(\s*\/\\\[\[\^\\\]\]\+\\\]\\s\*\/g,\s*""\s*\)/);
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
  assert.match(monthlyRecapBlock, /monthlyOutputDetails/);
  assert.match(monthlyRecapBlock, /monthly-recap-list/);
  assert.match(monthlyRecapBlock, /list\(recap\.ongoingProjects/);
  assert.match(monthlyRecapBlock, /list\(recap\.leadershipSummary/);
  assert.match(monthlyRecapBlock, /<li>\$\{escapeHtml\(item\)\}<\/li>/);
  assert.doesNotMatch(source, /weekSections\.flatMap\(\(section\) => section\.items\)\)\.slice\(0,\s*3\)/);
});

test("monthly quantified output details are grouped by business line", async () => {
  const source = await read("../static/app.js");
  const outputDetailsBlock = source.match(/function monthlyOutputDetails\(recap\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(outputDetailsBlock, /recap\.sections/);
  assert.match(outputDetailsBlock, /Product Line/);
  assert.match(outputDetailsBlock, /Brand/);
  assert.match(outputDetailsBlock, /IMC/);
  assert.match(outputDetailsBlock, /section\.quantifiedOutput/);
  assert.match(outputDetailsBlock, /section\.quantifiedItems/);
  assert.match(outputDetailsBlock, /monthly-output-line/);
});

test("frontend supports editing tasks and source records", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /function canPatchTask\(task\)/);
  assert.match(source, /data-edit-task/);
  assert.match(source, /data-inline-field/);
  assert.match(source, /bindInlineTaskControls/);
  assert.match(source, /saveTaskEdit/);
  assert.match(source, /\/api\/notion\/daily-work/);
  assert.match(source, /\/api\/notion\/tasks/);
  assert.match(source, /name="taskName"/);
});

test("frontend keeps edit available for tasks without source ids by saving a workflow task copy", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /function canPatchTask\(task\)/);
  assert.match(source, /return `<button class="text-action \$\{className\}" type="button" data-edit-task="\$\{taskKey\(task\)\}">Edit<\/button>`;/);
  assert.match(source, /if \(!canPatchTask\(task\)\) \{/);
  assert.match(source, /const created = await saveTaskToNotion\(task\);/);
  assert.match(source, /sourceType:\s*created\.sourceType \|\| "workflow-task"/);
});

test("frontend replaces the original unsourced row after creating a workflow task copy", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /HIDDEN_SOURCE_TASK_KEYS/);
  assert.match(source, /function hiddenSourceTaskKeys\(\)/);
  assert.match(source, /function rememberHiddenSourceTask\(key\)/);
  assert.match(source, /function hasEditableTaskCopy\(task, tasks\)/);
  assert.match(source, /data\.tasks\.filter\(\(task\) => !hidden\.has\(taskKey\(task\)\) && !hasEditableTaskCopy\(task, data\.tasks\)\)/);
  assert.match(source, /!hasEditableTaskCopy\(task, data\.tasks\)/);
  assert.match(source, /candidate\.sourceType === "workflow-task"/);
  assert.match(source, /function replaceTaskInState\(data, updatedTask, originalKey = ""\)/);
  assert.match(source, /taskKey\(task\) === originalKey/);
  assert.match(source, /replaceTaskInState\(data, savedTask, originalKey\)/);
  assert.match(source, /rememberHiddenSourceTask\(originalKey\)/);
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
  assert.match(source, /cleanInputDate/);
  assert.match(source, /taskTitle = cleanTaskText/);
  assert.match(source, /taskDetail = cleanTaskText/);
});

test("task dialogs use selectable categories and clean escaped text while editing", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /function taskCategoryOptions\(data, current = ""\)/);
  assert.match(source, /function normalizeEscapedText\(text\)/);
  assert.match(source, /form\.elements\.taskName\.value = normalizeEscapedText\(task\.taskName \|\| ""\)/);
  assert.match(source, /form\.elements\.nextAction\.value = normalizeEscapedText\(task\.nextAction \|\| ""\)/);
  assert.match(source, /taskName: normalizeEscapedText\(formData\.get\("taskName"\)\)/);
  assert.match(source, /<select name="category">/);
  assert.match(source, /taskCategoryOptions\(data\)/);
  assert.match(source, /form\.elements\.category\.value = normalizeEscapedText\(task\.category \|\| "Other"\)/);
  assert.match(source, /Mark for review/);
  assert.match(source, /Flags this item in Focus Items and Needs Review/);
  assert.doesNotMatch(source, /list="edit-category-options"/);
  assert.doesNotMatch(source, /id="edit-category-options"/);
});

test("escaped source tags are normalized before display", async () => {
  const source = await read("../static/app.js");
  const displayReportTextBlock = source.match(/function displayReportText\(text\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(displayReportTextBlock, /replace\(\s*\/\\\\\+\\\[\/g,\s*"\["\s*\)/);
  assert.match(displayReportTextBlock, /replace\(\s*\/\\\\\+\\\]\/g,\s*"\]"\s*\)/);
  assert.match(displayReportTextBlock, /replace\(\s*\/\\\[\[\^\\\]\]\+\\\]\\s\*\/g,\s*""\s*\)/);
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

test("overview metrics use compact narrow-screen layout", async () => {
  const styles = await read("../static/styles.css");

  assert.match(styles, /@media \(max-width:\s*720px\)/);
  assert.match(styles, /\.metric-card\s*\{[\s\S]*grid-template-columns:\s*44px minmax\(0,\s*1fr\) auto/);
  assert.match(styles, /\.metric-card strong\s*\{[\s\S]*grid-column:\s*3/);
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
