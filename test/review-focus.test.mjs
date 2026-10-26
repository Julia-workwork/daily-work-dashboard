import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { buildDashboard } from "../lib/workflow-domain.mjs";

const source = await readFile(new URL("../static/app.js", import.meta.url), "utf8");

function browserContext(tasks) {
  const overview = {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const context = vm.createContext({
    data: { ...buildDashboard({}), tasks },
    document: {
      querySelector: () => overview,
      querySelectorAll: () => [],
    },
    localStorage: { getItem: () => null },
  });
  // Evaluate the actual browser functions without installing listeners or booting the app.
  vm.runInContext(source.slice(0, source.indexOf("\nelements.tabs.forEach")), context);
  vm.runInContext('todayIso = () => "2026-10-26"; state.filters.month = "2026-10";', context);
  return { context, overview, run: code => vm.runInContext(code, context) };
}

function reviewTask(index, overrides = {}) {
  return {
    sourceId: `task-${index}`, sourceType: "workflow-task", taskName: `Review task ${index}`,
    status: "Done", needsReview: true, priority: "P2", category: "Other",
    dueDate: "2025-01-01", sourceDate: "2025-01-01", ...overrides,
  };
}

test("overview renders all review reminders, including completed tasks from old months", () => {
  const tasks = Array.from({ length: 120 }, (_, index) => reviewTask(index));
  const { run, overview } = browserContext(tasks);
  run("renderOverview(data)");
  assert.equal((overview.innerHTML.match(/class="focus-row"/g) || []).length, 120);
  assert.equal((overview.innerHTML.match(/data-complete-review=/g) || []).length, 120);
  assert.match(overview.innerHTML, /Review task 119/);
  assert.equal(run("countBy(data.tasks, isReviewTask)"), 120);
  run('state.filters.month = "2027-04"; todayIso = () => "2027-04-30"; renderOverview(data)');
  assert.equal((overview.innerHTML.match(/class="focus-row"/g) || []).length, 120);
});

test("review done removes the reminder without changing completion or deleting the task", () => {
  const { run } = browserContext([reviewTask(1)]);
  run("replaceTaskInState(data, reviewedTask(data.tasks[0]), taskKey(data.tasks[0]))");
  assert.equal(run('overviewFocusTasks(data.tasks, "2026-10").length'), 0);
  assert.equal(run("data.tasks.length"), 1);
  assert.equal(run("data.tasks[0].status"), "Done");
  assert.equal(run("data.tasks[0].needsReview"), false);
});

test("manual unmark clears the review and re-marking overrides a previous dismissal", () => {
  const { run } = browserContext([reviewTask(1)]);
  run("state.completedReviewFocusKeys.add(taskKey(data.tasks[0])); data.tasks[0].needsReview = false;");
  assert.equal(run('overviewFocusTasks(data.tasks, "2026-10").length'), 0);
  run("data.tasks[0].needsReview = true;");
  assert.equal(run('overviewFocusTasks(data.tasks, "2026-10").length'), 1);
});

test("automatic routine completion does not dismiss its review reminder", () => {
  const { run } = browserContext([reviewTask(1, {
    taskName: "[JL] Daily Routine - 2026-10-25", status: "In Progress", dueDate: "2026-10-25",
  })]);
  run('replaceTaskInState(data, { ...data.tasks[0], status: "Done", completedDate: "2026-10-25" })');
  assert.equal(run('overviewFocusTasks(data.tasks, "2026-10").length'), 1);
});

test("unflagged tasks keep their existing focus rules and reviews sort first", () => {
  const { run } = browserContext([
    reviewTask(1, { needsReview: false, status: "In Progress", dueDate: "2026-10-01", sourceDate: "2026-10-01" }),
    reviewTask(2),
    reviewTask(3, { needsReview: false }),
    reviewTask(4, { needsReview: false, status: "In Progress", dueDate: "2027-01-01" }),
  ]);
  assert.equal(run('JSON.stringify(overviewFocusTasks(data.tasks, "2026-10").map(task => task.sourceId))'), '["task-2","task-1"]');
});

test("Review Done saves the cleared flag before hiding an active task, and keeps it in Tasks", async () => {
  const { run, context, overview } = browserContext([reviewTask(1, {
    status: "In Progress", sourceDate: "2026-10-01", dueDate: "2026-10-01",
  })]);
  let click;
  const button = { dataset: { completeReview: run("taskKey(data.tasks[0])") },
    addEventListener: (_event, handler) => { click = handler; } };
  overview.querySelectorAll = () => [button];
  context.saveTaskEdit = async task => {
    assert.equal(task.needsReview, false);
    assert.equal(task.status, "In Progress");
    assert.equal(run('overviewFocusTasks(data.tasks, "2026-10").length'), 1);
    return { task };
  };
  context.showState = () => {};
  context.render = () => {};
  run("bindReviewDoneButtons(data)");
  await click();
  assert.equal(run('overviewFocusTasks(data.tasks, "2026-10").length'), 0);
  assert.equal(run("allTasks(data).length"), 1);
  assert.equal(run("data.tasks[0].status"), "In Progress");
});

test("a failed Review Done save leaves the reminder visible and retryable", async () => {
  const { run, context, overview } = browserContext([reviewTask(1)]);
  let click;
  const button = { dataset: { completeReview: run("taskKey(data.tasks[0])") },
    addEventListener: (_event, handler) => { click = handler; } };
  overview.querySelectorAll = () => [button];
  context.saveTaskEdit = async () => { throw new Error("Save failed"); };
  context.showState = () => {};
  run("bindReviewDoneButtons(data)");
  await click();
  assert.equal(run('overviewFocusTasks(data.tasks, "2026-10").length'), 1);
  assert.equal(run("data.tasks[0].needsReview"), true);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Review Done");
});
