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

test("monthly leadership summary uses one primary workstream per item and excludes category-only labels", async () => {
  const source = await read("../static/app.js");
  const reportSourceBlock = source.match(/function reportSourceText\(item\)\s*\{[\s\S]+?\n\}/)?.[0] || "";
  const workflowSectionsBlock = source.match(/function workflowSections\(items\)\s*\{[\s\S]+?\n\}/)?.[0] || "";
  const monthlyRecapBlock = source.match(/function monthlyRecap\(weeks\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(source, /function reportLineKey\(item\)/);
  assert.match(source, /function primaryWorkflowSectionName\(item\)/);
  assert.match(source, /function cleanLeadershipSummaryItem\(text\)/);
  assert.match(source, /function monthlyLeadershipSummary\(sections\)/);
  assert.match(workflowSectionsBlock, /primaryWorkflowSectionName\(item\)/);
  assert.match(monthlyRecapBlock, /leadershipSummary:\s*monthlyLeadershipSummary\(sections\)/);
  assert.doesNotMatch(reportSourceBlock, /item\.category/);
  assert.match(source, /isStandaloneSummaryNoise\(cleaned\)/);
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

test("overview focus items include a working edit dialog", async () => {
  const source = await read("../static/app.js");
  const renderOverviewBlock = source.match(/function renderOverview\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(renderOverviewBlock, /focusTasks\.map\(taskRow\)/);
  assert.match(renderOverviewBlock, /taskEditForm\(data\)/);
  assert.match(renderOverviewBlock, /bindTaskEditor\(data,\s*elements\.overview\)/);
  assert.match(renderOverviewBlock, /bindEditTaskButtons\(data,\s*elements\.overview\)/);
});

test("task edit bindings are scoped to the active view container", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /function bindEditTaskButtons\(data,\s*root = document\)/);
  assert.match(source, /function bindTaskEditor\(data,\s*root = document\)/);
  assert.match(source, /root\.querySelector\("#task-edit-dialog"\)/);
  assert.match(source, /root\.querySelectorAll\("\[data-edit-task\]"\)/);
  assert.match(source, /bindTaskEditor\(data,\s*elements\.overview\)/);
  assert.match(source, /bindEditTaskButtons\(data,\s*elements\.overview\)/);
  assert.match(source, /bindTaskEditor\(data,\s*elements\.tasks\)/);
  assert.match(source, /bindEditTaskButtons\(data,\s*elements\.tasks\)/);
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
  assert.match(source, /workstream:\s*"All"/);
  assert.match(source, /const TASK_WORKSTREAMS = \[/);
  assert.match(source, /function taskWorkstream\(task\)/);
  assert.match(source, /BD\|BR/);
  assert.match(source, /return value === "BD" \? "BR" : value/);
  assert.match(source, /filterSelect\("Workstream",\s*"workstream"/);
  assert.match(source, /filterWeekSelect/);
  assert.match(source, /canonicalWeekLabel/);
  assert.match(source, /reportWeekLabel/);
  assert.match(source, /state\.filters\.week/);
  assert.match(source, /state\.filters\.workstream/);
  assert.match(source, /cleanTaskText/);
  assert.match(source, /displayReportText\(text\)/);
  assert.match(source, /cleanInputDate/);
  assert.match(source, /taskTitle = cleanTaskText/);
  assert.match(source, /taskDetail = cleanTaskText/);
  assert.match(source, /preserveWorkstreamTag/);
});

test("tasks page supports keyword search across task details", async () => {
  const source = await read("../static/app.js");
  const styles = await read("../static/styles.css");
  const filteredTasksBlock = source.match(/function filteredTasks\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";
  const renderTasksBlock = source.match(/function renderTasks\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(source, /search:\s*""/);
  assert.match(source, /function taskSearchText\(task\)/);
  assert.match(source, /function taskMatchesSearch\(task\)/);
  assert.match(source, /data-task-search/);
  assert.match(source, /placeholder="Search tasks, notes, work log"/);
  assert.match(source, /state\.filters\.search/);
  assert.match(source, /task\.workLog/);
  assert.match(filteredTasksBlock, /taskMatchesSearch\(task\)/);
  assert.match(renderTasksBlock, /data-task-search/);
  assert.match(renderTasksBlock, /addEventListener\("input"/);
  assert.match(styles, /\.task-search/);
  assert.match(styles, /\.task-search input/);
});

test("dashboard supports switching between current and historical months", async () => {
  const source = await read("../static/app.js");
  const renderTasksBlock = source.match(/function renderTasks\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";
  const renderWeeklyBlock = source.match(/function renderWeekly\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(source, /month:\s*currentMonthKey\(\)/);
  assert.match(source, /function currentMonthKey\(\)/);
  assert.match(source, /function taskMonthKey\(task\)/);
  assert.match(source, /function availableMonthKeys\(data\)/);
  assert.match(source, /function selectedMonthKey\(data\)/);
  assert.match(source, /function monthFilterSelect\(data\)/);
  assert.match(source, /filterSelect\("Month",\s*"month"/);
  assert.match(source, /state\.filters\.month/);
  assert.match(source, /monthlyLeadershipReport\(data,\s*selectedMonthKey\(data\)\)/);
  assert.match(source, /state\.selectedWeek = ""/);
  assert.match(renderTasksBlock, /monthFilterSelect\(data\)/);
  assert.match(renderWeeklyBlock, /monthFilterSelect\(data\)/);
});

test("task dialogs use selectable categories and clean escaped text while editing", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /const DEFAULT_TASK_CATEGORIES = \["Product", "Content", "User Feedback", "Data", "IMC", "Brand", "Julia", "Other"\]/);
  assert.match(source, /function taskCategoryOptions\(data, current = ""\)/);
  assert.match(source, /function normalizeEscapedText\(text\)/);
  assert.match(source, /form\.elements\.taskName\.value = normalizeEscapedText\(task\.taskName \|\| ""\)/);
  assert.match(source, /form\.elements\.workstream\.value = taskWorkstream\(task\)/);
  assert.match(source, /form\.elements\.nextAction\.value = normalizeEscapedText\(task\.nextAction \|\| ""\)/);
  assert.match(source, /form\.elements\.workLog\.value = normalizeEscapedText\(task\.workLog \|\| ""\)/);
  assert.match(source, /taskName: applyWorkstreamPrefix\(normalizeEscapedText\(formData\.get\("taskName"\)\),\s*formData\.get\("workstream"\)\)/);
  assert.match(source, /workLog: normalizeEscapedText\(formData\.get\("workLog"\)\)/);
  assert.match(source, /name="workstream"/);
  assert.match(source, /<span>Work Log<\/span>/);
  assert.match(source, /<textarea name="workLog"/);
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
  assert.match(source, /taskToneClass\(field,\s*task\[field\]\)/);
  assert.match(styles, /\.direct-edit-cell/);
  assert.match(styles, /\.inline-task-select/);
});

test("task inline chips use distinct colors for category, priority, and status", async () => {
  const source = await read("../static/app.js");
  const styles = await read("../static/styles.css");

  assert.match(source, /function taskToneClass\(field,\s*value\)/);
  for (const token of ["category-product", "category-content", "category-feedback", "category-data", "category-brand", "category-julia", "priority-p1", "priority-p2", "priority-p3", "status-progress", "status-waiting", "status-done"]) {
    assert.match(source, new RegExp(token));
    assert.match(styles, new RegExp(`\\.tone-${token}`));
  }

  assert.match(styles, /\.inline-task-select\.tone-priority-p1/);
  assert.match(styles, /\.inline-task-select\.tone-category-content/);
  assert.match(styles, /\.inline-task-select\.tone-category-julia/);
  assert.match(styles, /\.inline-task-select\.tone-status-progress/);
});

test("task table uses a compact command-list layout", async () => {
  const source = await read("../static/app.js");
  const styles = await read("../static/styles.css");
  const tableRowBlock = styles.match(/\.table-row\s*\{[^}]+\}/)?.[0] || "";
  const taskTitleBlock = styles.match(/\.task-row-title\s*\{[^}]+\}/)?.[0] || "";
  const taskMetaBlock = styles.match(/\.task-row-meta\s*\{[^}]+\}/)?.[0] || "";

  assert.match(source, /class="task-row-main"/);
  assert.match(source, /class="task-row-title"/);
  assert.match(source, /class="task-row-meta"/);
  assert.match(source, /class="task-row-next"/);
  assert.match(tableRowBlock, /min-height:\s*64px/);
  assert.match(tableRowBlock, /grid-template-columns:\s*minmax\(360px,\s*1\.8fr\) 132px 88px 132px 96px minmax\(150px,\s*0\.7fr\) 58px/);
  assert.match(taskTitleBlock, /white-space:\s*nowrap/);
  assert.match(taskTitleBlock, /text-overflow:\s*ellipsis/);
  assert.match(taskMetaBlock, /font:\s*600 12px\/1\.3/);
  assert.match(styles, /\.table-row span\s*\{[\s\S]*border-left:\s*0/);
  assert.match(styles, /\.inline-task-select\s*\{[\s\S]*min-height:\s*28px/);
  assert.match(styles, /\.inline-task-select\s*\{[\s\S]*appearance:\s*none/);
  assert.match(styles, /\.direct-edit-cell\s*\{[\s\S]*display:\s*inline-block/);
});

test("task rows display the Notion created time as record time", async () => {
  const source = await read("../static/app.js");
  const styles = await read("../static/styles.css");

  assert.match(source, /function formatTaskRecordTime\(value\)/);
  assert.match(source, /task\.recordTime/);
  assert.match(source, /class="task-row-time"/);
  assert.match(styles, /\.task-row-time/);
});

test("tasks page includes a daily routine checklist with numeric counts", async () => {
  const source = await read("../static/app.js");
  const styles = await read("../static/styles.css");
  const renderTasksBlock = source.match(/function renderTasks\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(source, /DAILY_ROUTINE_STORAGE_KEY/);
  assert.match(source, /function loadDailyRoutineState\(\)/);
  assert.match(source, /function saveDailyRoutineState/);
  assert.match(source, /function dailyRoutinePanel\(data\)/);
  assert.match(source, /function bindDailyRoutine\(data\)/);
  assert.match(source, /data-routine-status-wrap/);
  assert.match(source, /data-save-routine/);
  assert.match(source, /data-routine-field="emailsCount"/);
  assert.match(source, /data-routine-field="postsCount"/);
  assert.match(source, /data-routine-field="userIssuesCount"/);
  assert.match(source, /data-routine-field="userRequestsCount"/);
  for (const label of ["Daily Routine", "Handle emails", "Check 3 groups", "Publish post", "Handle user issues", "Handle user requests", "Save Daily Routine"]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(renderTasksBlock, /dailyRoutinePanel\(data\)/);
  assert.match(renderTasksBlock, /bindDailyRoutine\(data\)/);
  assert.match(styles, /\.daily-routine-panel/);
  assert.match(styles, /\.routine-number/);
  assert.match(styles, /\.routine-item\.is-done/);
});

test("daily routine changes wait for an explicit save button before writing to Notion", async () => {
  const source = await read("../static/app.js");
  const bindBlock = source.match(/function bindDailyRoutine\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";
  const changeBlock = bindBlock.match(/control\.addEventListener\("change",\s*\(\)\s*=>\s*\{[\s\S]+?markUnsaved\(\);\n\s*\}\);/)?.[0] || "";

  assert.match(bindBlock, /const saveButton = panel\.querySelector\("\[data-save-routine\]"\)/);
  assert.match(bindBlock, /saveButton\?\.addEventListener\("click",\s*\(\)\s*=>\s*persistRoutine\(\)\)/);
  assert.match(bindBlock, /Unsaved changes/);
  assert.match(changeBlock, /markUnsaved\(\)/);
  assert.doesNotMatch(changeBlock, /persistRoutine\(\)/);
});

test("daily routine saves one Notion record per day for reporting", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /function dailyRoutineTaskName\(\)/);
  assert.match(source, /\`\[JL\] Daily Routine - \$\{todayIso\(\)\}\`/);
  assert.match(source, /function findDailyRoutineTask\(data\)/);
  assert.match(source, /function parseDailyRoutineTask\(task\)/);
  assert.match(source, /function dailyRoutineStateForData\(data\)/);
  assert.match(source, /function dailyRoutineTaskPayload\(routine\)/);
  assert.match(source, /function saveDailyRoutineToNotion\(data,\s*routine\)/);
  assert.match(source, /await saveTaskEdit\(task\)/);
  assert.match(source, /await saveTaskToNotion\(task\)/);
  assert.match(source, /sourceDate:\s*todayIso\(\)/);
  assert.match(source, /category:\s*"Julia"/);
  assert.match(source, /priority:\s*"P2"/);
  assert.match(source, /workLog:\s*`\[JL\] Daily Routine: \$\{parts\.join\("; "\)\}\.`/);
  assert.match(source, /nextAction:\s*""/);
  assert.match(source, /task\?\.workLog \|\| task\?\.nextAction/);
  assert.match(source, /data-routine-save-status/);
  assert.match(source, /Handled \$\{emailCount\} emails/);
  assert.match(source, /handled \$\{userIssueCount\} user issues/);
  assert.match(source, /handled \$\{userRequestCount\} user requests/);
  assert.match(source, /published \$\{postCount\} posts/);
});

test("daily routine creates a new record when the existing Notion row is archived", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /function isArchivedNotionRecordError\(error\)/);
  assert.match(source, /block that is archived/i);
  assert.match(source, /catch \(error\) \{/);
  assert.match(source, /if \(!task\.sourceId \|\| !isArchivedNotionRecordError\(error\)\) throw error;/);
  assert.match(source, /sourceId:\s*""/);
  assert.match(source, /result = await saveTaskToNotion\(taskToSave\)/);
});

test("task board supports synced this week ongoing work", async () => {
  const source = await read("../static/app.js");
  const styles = await read("../static/styles.css");
  const renderTasksBlock = source.match(/function renderTasks\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";
  const taskCreatorBlock = source.match(/function bindTaskCreator\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(source, /function isWorkflowOngoingTask\(task\)/);
  assert.match(source, /function taskBoardWeekRange\(data,\s*taskPool\)/);
  assert.match(source, /function ongoingTaskPayload\(text,\s*weekRange\)/);
  assert.match(source, /taskName:\s*`\[JL\] Ongoing - \$\{cleaned\}`/);
  assert.match(source, /status:\s*"In Progress"/);
  assert.match(source, /category:\s*"Julia"/);
  assert.match(source, /function taskBoardOngoingPanel\(data,\s*taskPool\)/);
  assert.match(source, /function bindOngoingCreator\(data\)/);
  assert.match(source, /data-open-ongoing/);
  assert.match(source, /function prefillOngoingTaskForm\(form,\s*weekRange\)/);
  assert.match(source, /Current Progress/);
  assert.match(source, /data-ongoing-save-status/);
  assert.match(source, /\[JL\] Ongoing - /);
  assert.match(taskCreatorBlock, /const savedTask = \{\s*\.\.\.task,\s*sourceId:\s*result\.sourceId/s);
  assert.match(taskCreatorBlock, /upsertTaskInData\(data,\s*savedTask\)/);
  assert.match(source, /saveTaskToNotion\(task\)/);
  assert.match(renderTasksBlock, /taskBoardOngoingPanel\(data,\s*taskPool\)/);
  assert.match(renderTasksBlock, /bindOngoingCreator\(data\)/);
  assert.match(styles, /\.task-ongoing-panel/);
  assert.match(styles, /\.ongoing-item-progress/);
});

test("workflow ongoing tasks are included in weekly and monthly ongoing reports", async () => {
  const source = await read("../static/app.js");
  const reportItemsBlock = source.match(/function reportItemsForMonth\(data,\s*monthKey\)\s*\{[\s\S]+?\n\}/)?.[0] || "";
  const weeklyOngoingBlock = source.match(/function weeklyOngoingItems\(data,\s*weekRange\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(reportItemsBlock, /type:\s*isWorkflowOngoingTask\(task\) \? "ongoing" : "task"/);
  assert.match(weeklyOngoingBlock, /data\.tasks/);
  assert.match(weeklyOngoingBlock, /isWorkflowWeeklyOngoingTask\(task\)/);
  assert.match(weeklyOngoingBlock, /reportWeekLabel\(data,\s*date\) === weekRange/);
  assert.match(weeklyOngoingBlock, /task:\s*task/);
});

test("task board supports synced this month ongoing work separately from weekly ongoing work", async () => {
  const source = await read("../static/app.js");
  const styles = await read("../static/styles.css");
  const renderTasksBlock = source.match(/function renderTasks\(data\)\s*\{[\s\S]+?\n\}/)?.[0] || "";

  assert.match(source, /function isWorkflowMonthlyOngoingTask\(task\)/);
  assert.match(source, /function monthlyOngoingItems\(data,\s*monthKey\)/);
  assert.match(source, /function taskBoardMonthlyOngoingPanel\(data\)/);
  assert.match(source, /function bindMonthlyOngoingCreator\(data\)/);
  assert.match(source, /data-open-monthly-ongoing/);
  assert.match(source, /\[JL\] Monthly Ongoing - /);
  assert.match(source, /This Month Ongoing/);
  assert.match(source, /Current Progress/);
  assert.match(renderTasksBlock, /taskBoardMonthlyOngoingPanel\(data\)/);
  assert.match(renderTasksBlock, /bindMonthlyOngoingCreator\(data\)/);
  assert.match(styles, /\.task-monthly-ongoing-panel/);
});

test("frontend shows a saved dashboard snapshot while Notion syncs", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /WORKFLOW_SNAPSHOT_STORAGE_KEY/);
  assert.match(source, /function loadWorkflowSnapshot\(\)/);
  assert.match(source, /function saveWorkflowSnapshot\(payload\)/);
  assert.match(source, /function showWorkflowSnapshotWhileSyncing\(\)/);
  assert.match(source, /Showing saved dashboard while syncing Notion/);
  assert.match(source, /saveWorkflowSnapshot\(payload\)/);
});

test("overview focus items keep edit and colored status chips in one action area", async () => {
  const source = await read("../static/app.js");
  const styles = await read("../static/styles.css");

  assert.match(source, /class="focus-actions"/);
  assert.match(source, /class="focus-stamps"/);
  assert.match(source, /taskStatusChips\(task\)/);
  assert.match(source, /editTaskButton\(task,\s*"focus-edit-action"\)/);
  assert.match(styles, /\.focus-actions/);
  assert.match(styles, /\.focus-edit-action/);
  assert.match(styles, /\.priority-p1/);
  assert.match(styles, /\.status-progress/);
  assert.match(styles, /\.status-waiting/);
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

test("frontend labels stale cache as ready while updating", async () => {
  const source = await read("../static/app.js");

  assert.match(source, /stale-refreshing/);
  assert.match(source, /Ready \$\{time\} · updating/);
});
