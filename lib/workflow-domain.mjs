export const DEFAULT_SPREADSHEET_ID = "1naGkpafFZAuhmd--P-Qs_YZ94Dom1TVd0sw3-RVyX4A";
export const DEFAULT_SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/1naGkpafFZAuhmd--P-Qs_YZ94Dom1TVd0sw3-RVyX4A/edit";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GOOGLE_SHEETS_EPOCH = Date.UTC(1899, 11, 30);

const FIELD_NAMES = {
  Date: "date",
  Weekday: "weekday",
  "Week Range": "weekRange",
  "Notion Source": "notionSource",
  "Completed Work": "completedWork",
  "Key Outputs": "keyOutputs",
  "In Progress": "inProgress",
  "Follow-ups": "followUps",
  "Risks / Issues": "risksIssues",
  "Tomorrow Reminders": "tomorrowReminders",
  "Weekly Report Candidate": "weeklyReportCandidate",
  Notes: "notes",
  "Task Name": "taskName",
  Category: "category",
  Priority: "priority",
  Status: "status",
  "Due Date": "dueDate",
  "Source Date": "sourceDate",
  "Notion Link": "notionLink",
  "Next Action": "nextAction",
  "Work Log": "workLog",
  "Needs Review": "needsReview",
  "Completed Date": "completedDate",
  "Source ID": "sourceId",
  "Source Type": "sourceType",
  "Key Outcomes": "keyOutcomes",
  "Category Summary": "categorySummary",
  "Data / Links": "dataLinks",
  "Continued Follow-ups": "continuedFollowUps",
  "Next Week Plan": "nextWeekPlan",
  "Draft Weekly Report": "draftWeeklyReport",
  "Open Tasks": "openTasks",
  "Done Tasks": "doneTasks",
  "This Week Items": "thisWeekItems",
};

function clean(value) {
  return String(value ?? "").trim();
}

export function googleSerialToDate(serial) {
  const date = new Date(GOOGLE_SHEETS_EPOCH + Number(serial) * MS_PER_DAY);
  return date.toISOString().slice(0, 10);
}

export function normalizeDate(value) {
  const text = clean(value);
  if (!text) return "";
  if (/^\d{5}(?:\.\d+)?$/.test(text)) return googleSerialToDate(Number(text));

  const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return text;
}

export function rowsToObjects(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headers = rows[0].map(clean);

  return rows
    .slice(1)
    .filter((row) => row.some((value) => clean(value)))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function booleanValue(value) {
  const text = clean(value).toLowerCase();
  return value === true || text === "true" || text === "yes" || text === "1";
}

function numberValue(value) {
  const number = Number(clean(value));
  return Number.isFinite(number) ? number : 0;
}

function mapFields(row) {
  const mapped = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[FIELD_NAMES[key] || key] = value;
  }
  return mapped;
}

export function normalizeDailyExtract(row) {
  const item = mapFields(row);
  item.date = normalizeDate(item.date);
  return item;
}

export function normalizeTask(row) {
  const item = mapFields(row);
  item.taskName = clean(item.taskName);
  item.category = clean(item.category) || "Other";
  item.priority = clean(item.priority) || "P3";
  item.status = clean(item.status) || "Not Started";
  item.dueDate = normalizeDate(item.dueDate);
  item.sourceDate = normalizeDate(item.sourceDate);
  item.completedDate = normalizeDate(item.completedDate);
  item.needsReview = booleanValue(item.needsReview);
  item.sourceId = clean(item.sourceId);
  item.sourceType = clean(item.sourceType) || (item.sourceId ? "workflow-task" : "");
  return item;
}

export function normalizeWeeklyReview(row) {
  return mapFields(row);
}

export function normalizeCategorySummary(row) {
  const item = mapFields(row);
  return {
    category: clean(item.category),
    openTasks: numberValue(item.openTasks),
    doneTasks: numberValue(item.doneTasks),
    needsReview: numberValue(item.needsReview),
    thisWeekItems: numberValue(item.thisWeekItems),
  };
}

export function groupSettings(rows) {
  const groups = {
    categories: [],
    priorities: [],
    statuses: [],
    keywords: [],
  };
  const typeMap = {
    Category: "categories",
    Priority: "priorities",
    Status: "statuses",
    Keyword: "keywords",
  };

  for (const row of rows) {
    const target = typeMap[clean(row.Type)];
    const value = clean(row.Value);
    if (target && value) groups[target].push(value);
  }

  return groups;
}

function taskIsDone(task) {
  return clean(task.status).toLowerCase() === "done";
}

function compareDate(left, right) {
  if (!left || !right) return 0;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function weekBounds(today) {
  const date = new Date(`${today}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - day + 1);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function isWithinWeek(value, bounds) {
  return Boolean(value && value >= bounds.start && value <= bounds.end);
}

function taskRank(task, today) {
  const done = taskIsDone(task);
  const p1 = task.priority === "P1";
  const overdue = task.dueDate && compareDate(task.dueDate, today) < 0 && !done;
  const dueToday = task.dueDate === today && !done;

  if (done) return 90;
  if (overdue && p1) return 1;
  if (dueToday && p1) return 2;
  if (p1) return 3;
  if (overdue) return 4;
  if (dueToday) return 5;
  if (task.status === "Waiting on Others") return 6;
  if (task.status === "In Progress") return 7;
  if (task.status === "Not Started") return 8;
  return 20;
}

export function sortTasks(tasks, today = new Date().toISOString().slice(0, 10)) {
  return [...tasks].sort((left, right) => {
    const rank = taskRank(left, today) - taskRank(right, today);
    if (rank) return rank;
    return clean(left.taskName).localeCompare(clean(right.taskName), "zh-Hans-CN");
  });
}

export function buildTodayFocus(tasks, today = new Date().toISOString().slice(0, 10)) {
  const bounds = weekBounds(today);
  return sortTasks(
    tasks.filter((task) => {
      if (taskIsDone(task)) return false;
      const overdue = task.dueDate && compareDate(task.dueDate, today) < 0;
      const inThisWeek = isWithinWeek(task.dueDate, bounds) || isWithinWeek(task.sourceDate, bounds);
      const review = task.status === "Needs Review" || task.needsReview;
      return (
        inThisWeek ||
        overdue ||
        review
      );
    }),
    today,
  );
}

export function latestWeeklyReview(rows) {
  return rows.length ? rows[rows.length - 1] : {};
}

export function buildDashboard(rawTabs, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const dailyExtracts = rowsToObjects(rawTabs.dailyExtracts).map(normalizeDailyExtract);
  const tasks = sortTasks(rowsToObjects(rawTabs.tasks).map(normalizeTask), today);
  const weeklyRows = rowsToObjects(rawTabs.weeklyReview).map(normalizeWeeklyReview);
  const categorySummary = rowsToObjects(rawTabs.categorySummary)
    .map(normalizeCategorySummary)
    .filter((row) => row.category);
  const settingsRows = rowsToObjects(rawTabs.settings);

  return {
    updatedAt: new Date().toISOString(),
    source: options.source || {
      spreadsheetId: options.spreadsheetId || DEFAULT_SPREADSHEET_ID,
      spreadsheetUrl: options.spreadsheetUrl || DEFAULT_SPREADSHEET_URL,
    },
    dailyExtracts,
    tasks,
    todayFocus: buildTodayFocus(tasks, today),
    weeklyReview: latestWeeklyReview(weeklyRows),
    categorySummary,
    settings: groupSettings(settingsRows),
  };
}
