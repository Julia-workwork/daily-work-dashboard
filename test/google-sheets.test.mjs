import test from "node:test";
import assert from "node:assert/strict";
import { parseCsvRows } from "../lib/csv.mjs";
import { fetchWorkflowTabs, sheetCsvUrl } from "../lib/google-sheets.mjs";

test("parseCsvRows handles quotes, commas, and blank cells", () => {
  assert.deepEqual(parseCsvRows('A,B,C\n"hello, world","line ""two""",\n'), [
    ["A", "B", "C"],
    ["hello, world", 'line "two"', ""],
  ]);
});

test("parseCsvRows handles CRLF rows", () => {
  assert.deepEqual(parseCsvRows("A,B\r\n1,2\r\n"), [
    ["A", "B"],
    ["1", "2"],
  ]);
});

test("sheetCsvUrl uses sheet name export path", () => {
  assert.equal(
    sheetCsvUrl("abc123", "Task Tracker"),
    "https://docs.google.com/spreadsheets/d/abc123/gviz/tq?tqx=out:csv&sheet=Task%20Tracker",
  );
});

test("fetchWorkflowTabs fetches all required tabs", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    return {
      ok: true,
      status: 200,
      text: async () => "A,B\n1,2\n",
    };
  };

  const tabs = await fetchWorkflowTabs({ spreadsheetId: "abc123", fetchImpl });
  assert.deepEqual(Object.keys(tabs), ["dailyExtracts", "tasks", "weeklyReview", "categorySummary", "settings"]);
  assert.equal(tabs.tasks[1][0], "1");
  assert.equal(requested.some((url) => url.includes("Daily%20Extract")), true);
  assert.equal(requested.some((url) => url.includes("Task%20Tracker")), true);
  assert.equal(requested.some((url) => url.includes("Weekly%20Review")), true);
  assert.equal(requested.some((url) => url.includes("Category%20Summary")), true);
  assert.equal(requested.some((url) => url.includes("Settings")), true);
});

test("fetchWorkflowTabs explains unreadable sheet errors", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 403,
    text: async () => "Forbidden",
  });

  await assert.rejects(
    () => fetchWorkflowTabs({ spreadsheetId: "abc123", fetchImpl }),
    /not readable.*CSV export/i,
  );
});
