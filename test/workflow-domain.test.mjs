import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDashboard,
  buildTodayFocus,
  googleSerialToDate,
  groupSettings,
  normalizeDate,
  rowsToObjects,
  sortTasks,
} from "../lib/workflow-domain.mjs";

test("rowsToObjects maps headers and ignores blank rows", () => {
  const rows = [
    ["Task Name", "Status"],
    ["A", "In Progress"],
    ["", ""],
    ["B", "Done"],
  ];

  assert.deepEqual(rowsToObjects(rows), [
    { "Task Name": "A", Status: "In Progress" },
    { "Task Name": "B", Status: "Done" },
  ]);
});

test("normalizeDate handles Google serial numbers and date strings", () => {
  assert.equal(googleSerialToDate(46190), "2026-06-17");
  assert.equal(normalizeDate("46191"), "2026-06-18");
  assert.equal(normalizeDate("2026-06-17"), "2026-06-17");
  assert.equal(normalizeDate(""), "");
});

test("buildTodayFocus includes urgent, waiting, and review tasks", () => {
  const tasks = [
    { taskName: "P1 open", priority: "P1", status: "In Progress", dueDate: "2026-06-20", needsReview: false },
    { taskName: "Overdue", priority: "P2", status: "Not Started", dueDate: "2026-06-16", needsReview: false },
    { taskName: "Due today", priority: "P3", status: "Not Started", dueDate: "2026-06-17", needsReview: false },
    { taskName: "Waiting", priority: "P2", status: "Waiting on Others", dueDate: "", needsReview: false },
    { taskName: "Review flag", priority: "P2", status: "Not Started", dueDate: "", needsReview: true },
    { taskName: "Done p1", priority: "P1", status: "Done", dueDate: "2026-06-17", needsReview: true },
  ];

  assert.deepEqual(
    buildTodayFocus(tasks, "2026-06-17").map((task) => task.taskName),
    ["P1 open", "Overdue", "Due today", "Waiting", "Review flag"],
  );
});

test("sortTasks orders by urgency and completion", () => {
  const tasks = [
    { taskName: "Done", priority: "P1", status: "Done", dueDate: "2026-06-16" },
    { taskName: "Waiting", priority: "P2", status: "Waiting on Others", dueDate: "" },
    { taskName: "P1 today", priority: "P1", status: "Not Started", dueDate: "2026-06-17" },
    { taskName: "P1 overdue", priority: "P1", status: "In Progress", dueDate: "2026-06-16" },
  ];

  assert.deepEqual(sortTasks(tasks, "2026-06-17").map((task) => task.taskName), [
    "P1 overdue",
    "P1 today",
    "Waiting",
    "Done",
  ]);
});

test("groupSettings groups rows by type", () => {
  const settings = [
    { Type: "Category", Value: "Content Publishing" },
    { Type: "Priority", Value: "P1" },
    { Type: "Status", Value: "Done" },
    { Type: "Keyword", Value: "跟进" },
  ];

  assert.deepEqual(groupSettings(settings), {
    categories: ["Content Publishing"],
    priorities: ["P1"],
    statuses: ["Done"],
    keywords: ["跟进"],
  });
});

test("buildDashboard normalizes tabs into dashboard response", () => {
  const dashboard = buildDashboard(
    {
      dailyExtracts: [
        ["Date", "Weekday", "Week Range", "Notion Source", "Completed Work"],
        ["46190", "Wednesday", "2026.06.15-2026.06.18", "notion", "done"],
      ],
      tasks: [
        ["Task Name", "Category", "Priority", "Status", "Due Date", "Source Date", "Notion Link", "Next Action", "Needs Review", "Completed Date"],
        ["跟IMC 对一下用户的标签，给到研发这边", "Data Review", "P1", "Waiting on Others", "46191", "46190", "notion", "对齐用户标签", "TRUE", ""],
      ],
      weeklyReview: [
        ["Week Range", "Key Outcomes", "Category Summary", "Data / Links", "Risks / Issues", "Continued Follow-ups", "Next Week Plan", "Draft Weekly Report"],
        ["2026.06.15-2026.06.18", "成果", "分类", "链接", "风险", "跟进", "计划", "周报"],
      ],
      categorySummary: [
        ["Category", "Open Tasks", "Done Tasks", "Needs Review", "This Week Items"],
        ["Data Review", "1", "0", "1", "1"],
      ],
      settings: [
        ["Type", "Value", "Color", "Description", "Active"],
        ["Priority", "P1", "#F4CCCC", "高影响事项", "TRUE"],
      ],
    },
    {
      today: "2026-06-17",
      spreadsheetId: "sheet-id",
      spreadsheetUrl: "sheet-url",
    },
  );

  assert.equal(dashboard.dailyExtracts[0].date, "2026-06-17");
  assert.equal(dashboard.tasks[0].taskName, "跟IMC 对一下用户的标签，给到研发这边");
  assert.equal(dashboard.todayFocus.length, 1);
  assert.equal(dashboard.weeklyReview.draftWeeklyReport, "周报");
  assert.equal(dashboard.categorySummary[0].category, "Data Review");
  assert.deepEqual(dashboard.settings.priorities, ["P1"]);
});

test("buildDashboard selects the latest weekly review row", () => {
  const dashboard = buildDashboard({
    dailyExtracts: [["Date"]],
    tasks: [["Task Name"]],
    weeklyReview: [
      ["Week Range", "Key Outcomes", "Draft Weekly Report"],
      ["2026.06.08-2026.06.12", "older outcomes", "older report"],
      ["2026.06.15-2026.06.18", "latest outcomes", "latest report"],
    ],
    categorySummary: [["Category"]],
    settings: [["Type", "Value"]],
  });

  assert.equal(dashboard.weeklyReview.weekRange, "2026.06.15-2026.06.18");
  assert.equal(dashboard.weeklyReview.keyOutcomes, "latest outcomes");
  assert.equal(dashboard.weeklyReview.draftWeeklyReport, "latest report");
});
