const state = {
  data: null,
  activeView: "overview",
  localTasks: [],
  selectedWeek: "",
  visibleTasks: [],
  filters: {
    week: "All",
    priority: "All",
    status: "All",
    category: "All",
  },
};

const elements = {
  sourceLine: document.querySelector("#source-line"),
  statePanel: document.querySelector("#state-panel"),
  authPanel: document.querySelector("#auth-panel"),
  authForm: document.querySelector("#auth-form"),
  authPassword: document.querySelector("#auth-password"),
  authMessage: document.querySelector("#auth-message"),
  overview: document.querySelector("#overview-view"),
  tasks: document.querySelector("#tasks-view"),
  weekly: document.querySelector("#weekly-view"),
  settings: document.querySelector("#settings-view"),
  refresh: document.querySelector("#refresh-button"),
  tabs: [...document.querySelectorAll(".tab")],
};

const DEFAULT_TASK_CATEGORIES = ["Product", "Content", "User Feedback", "Data", "IMC", "Brand", "Julia", "Other"];
const HIDDEN_SOURCE_TASK_KEYS = "daily-work-hidden-source-task-keys";
const DAILY_ROUTINE_STORAGE_KEY = "daily-work-daily-routine";
const DEFAULT_DAILY_ROUTINE = {
  emailsDone: false,
  emailsCount: "",
  groupsDone: false,
  postsDone: false,
  postsCount: "",
};

const WORKFLOW_TAG_GROUPS = [
  {
    title: "Product Line",
    tags: ["[PL]", "[UI]"],
    aliases: ["Product Line", "PL", "User Issue", "UI"],
    detail: "Product, firmware, beta, user issues",
  },
  {
    title: "Brand",
    tags: ["[BR]", "[CT]"],
    aliases: ["Brand", "BR", "Content", "CT"],
    detail: "Social posts, content, brand operations",
  },
  {
    title: "IMC",
    tags: ["[IMC]"],
    aliases: ["IMC"],
    detail: "Labels, reports, alignment, communication files",
  },
  {
    title: "Julia",
    tags: ["[JL]"],
    aliases: ["JULIA", "JL"],
    detail: "Your own initiatives and planning work",
  },
  {
    title: "Planning",
    tags: ["[ID]", "[PN]", "[TBD]"],
    aliases: ["Idea", "ID", "Plan", "PN", "TBD"],
    detail: "Ideas, plans, and work that should happen next",
  },
  {
    title: "Data",
    tags: ["[DA]"],
    aliases: ["Data", "DA"],
    detail: "Use with [PL], [BR], or [IMC] when the item is data support",
  },
];

const REPORT_LINES = [
  {
    title: "Product Line",
    tags: ["Product Line", "User Issue"],
    keywords: /产品|功能|固件|firmware|beta|APRS|Message|HA2|H1|需求|研发|PM|测试|User Issue|用户|问题|RV\d+|RT\d+|LR\d+/i,
  },
  {
    title: "Brand",
    tags: ["Brand", "Content"],
    keywords: /品牌|社媒|social|post|YouTube|TikTok|blog|博客|图片|素材|活动|展会|KOC|KOL|美工|数据指标|粉丝/i,
  },
  {
    title: "IMC",
    tags: ["IMC"],
    keywords: /IMC|汇报|用户标签|标签|洞察|PPT|排期|对齐|传播|文件更新/i,
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function splitText(value) {
  return String(value ?? "")
    .split(/;|；|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function listText(value) {
  const items = splitText(value);
  if (!items.length) return '<span class="muted">No notes captured yet.</span>';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function countBy(items, predicate) {
  return items.filter(predicate).length;
}

function isDone(task) {
  return task.status === "Done";
}

function isWorkflowOngoingTask(task) {
  const text = normalizeEscapedText([task.taskName, task.nextAction].filter(Boolean).join(" "));
  return /\[JL\]\s*Ongoing|Ongoing\s*-/i.test(text);
}

function workflowOngoingReportText(task) {
  return `[JL] ${normalizeEscapedText(task.nextAction || task.taskName || "Ongoing work")}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "en"));
}

function hiddenSourceTaskKeys() {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_SOURCE_TASK_KEYS) || "[]"));
  } catch {
    return new Set();
  }
}

function rememberHiddenSourceTask(key) {
  if (!key) return;
  const keys = hiddenSourceTaskKeys();
  keys.add(key);
  try {
    localStorage.setItem(HIDDEN_SOURCE_TASK_KEYS, JSON.stringify([...keys]));
  } catch {
    // Browser storage can be unavailable in private modes; the saved Notion row still remains valid.
  }
}

function hasEditableTaskCopy(task, tasks) {
  if (task.sourceId) return false;
  return tasks.some(
    (candidate) =>
      candidate.sourceType === "workflow-task" &&
      candidate.sourceId &&
      candidate.taskName === task.taskName &&
      candidate.dueDate === task.dueDate,
  );
}

function allTasks(data) {
  const hidden = hiddenSourceTaskKeys();
  return [...state.localTasks, ...data.tasks.filter((task) => !hidden.has(taskKey(task)) && !hasEditableTaskCopy(task, data.tasks))];
}

function cleanInputDate(value) {
  const text = String(value || "").trim().replaceAll("/", "-");
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return text;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeEscapedText(text) {
  return String(text || "")
    .replace(/\\+\[/g, "[")
    .replace(/\\+\]/g, "]")
    .replace(/^\\+/, "")
    .trim();
}

function taskCategoryOptions(data, current = "") {
  return unique([...DEFAULT_TASK_CATEGORIES, ...allTasks(data).map((task) => task.category), current].filter(Boolean))
    .map((value) => `<option value="${escapeHtml(value)}" ${current === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function taskFromForm(form) {
  const formData = new FormData(form);
  return {
    taskName: normalizeEscapedText(formData.get("taskName")),
    nextAction: normalizeEscapedText(formData.get("nextAction")),
    category: String(formData.get("category") || "").trim() || "Other",
    priority: String(formData.get("priority") || "P2"),
    status: String(formData.get("status") || "Not Started"),
    dueDate: cleanInputDate(formData.get("dueDate")),
    sourceDate: todayIso(),
    completedDate: "",
    needsReview: formData.get("needsReview") === "on",
  };
}

function taskFromEditForm(form, original = {}) {
  const formData = new FormData(form);
  return {
    ...original,
    taskName: normalizeEscapedText(formData.get("taskName")),
    nextAction: normalizeEscapedText(formData.get("nextAction")),
    category: String(formData.get("category") || "").trim() || "Other",
    priority: String(formData.get("priority") || "P2"),
    status: String(formData.get("status") || "Not Started"),
    dueDate: cleanInputDate(formData.get("dueDate")),
    needsReview: formData.get("needsReview") === "on",
  };
}

function priorityClass(priority) {
  const classes = {
    P1: "priority-p1",
    P2: "priority-p2",
    P3: "priority-p3",
  };
  return classes[priority] || "";
}

function statusClass(status) {
  const key = String(status || "").toLowerCase();
  if (key.includes("waiting")) return "status-waiting";
  if (key.includes("review")) return "status-review";
  if (key.includes("done")) return "status-done";
  if (key.includes("progress")) return "status-progress";
  return "";
}

function taskToneClass(field, value) {
  const key = String(value || "").toLowerCase();
  if (field === "priority") return `tone-${priorityClass(value) || "priority-p2"}`;
  if (field === "status") return `tone-${statusClass(value) || "status-not-started"}`;
  if (field === "category") {
    if (key.includes("product")) return "tone-category-product";
    if (key.includes("content")) return "tone-category-content";
    if (key.includes("feedback") || key.includes("support") || key.includes("user")) return "tone-category-feedback";
    if (key.includes("data") || key.includes("report")) return "tone-category-data";
    if (key.includes("imc") || key.includes("brand")) return "tone-category-brand";
    if (key.includes("julia")) return "tone-category-julia";
    if (key.includes("social")) return "tone-category-social";
    if (key.includes("meeting") || key.includes("operation")) return "tone-category-operations";
  }
  return "tone-neutral";
}

function chip(value, kind = "") {
  const className = ["stamp-chip", kind].filter(Boolean).join(" ");
  return `<span class="${className}">${escapeHtml(value || "Blank")}</span>`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function loadDailyRoutineState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DAILY_ROUTINE_STORAGE_KEY) || "{}");
    if (saved.date === todayIso()) {
      return { ...DEFAULT_DAILY_ROUTINE, ...saved };
    }
  } catch {
    // If local storage is unavailable, the routine still works for the current render.
  }
  return { date: todayIso(), ...DEFAULT_DAILY_ROUTINE };
}

function saveDailyRoutineState(nextState) {
  const stateForToday = { date: todayIso(), ...DEFAULT_DAILY_ROUTINE, ...nextState };
  try {
    localStorage.setItem(DAILY_ROUTINE_STORAGE_KEY, JSON.stringify(stateForToday));
  } catch {
    // Daily routine is intentionally local-only, so storage failure should not block task work.
  }
  return stateForToday;
}

function dailyRoutineTaskName() {
  return `[JL] Daily Routine - ${todayIso()}`;
}

function findDailyRoutineTask(data) {
  const name = dailyRoutineTaskName();
  return allTasks(data).find((task) => normalizeEscapedText(task.taskName) === name);
}

function parseDailyRoutineTask(task) {
  const text = normalizeEscapedText(task?.workLog || task?.nextAction || "");
  const emails = text.match(/Handled\s+(\d+)\s+emails/i);
  const posts = text.match(/published\s+(\d+)\s+posts/i);
  return {
    date: todayIso(),
    emailsDone: Boolean(emails),
    emailsCount: emails?.[1] || "",
    groupsDone: /checked\s+3\s+groups/i.test(text),
    postsDone: Boolean(posts),
    postsCount: posts?.[1] || "",
    sourceId: task?.sourceId || "",
    sourceType: task?.sourceType || "workflow-task",
    notionUrl: task?.notionUrl || "",
  };
}

function hasRoutineInput(routine) {
  return Boolean(routine.emailsDone || routine.groupsDone || routine.postsDone || routine.emailsCount || routine.postsCount || routine.sourceId);
}

function dailyRoutineStateForData(data) {
  const localRoutine = loadDailyRoutineState();
  const existingTask = data ? findDailyRoutineTask(data) : null;
  if (!existingTask || hasRoutineInput(localRoutine)) return localRoutine;
  const parsed = parseDailyRoutineTask(existingTask);
  saveDailyRoutineState(parsed);
  return parsed;
}

function dailyRoutineTaskPayload(routine) {
  const emailCount = Number(routine.emailsCount || 0);
  const postCount = Number(routine.postsCount || 0);
  const isComplete = Boolean(routine.emailsDone && routine.groupsDone && routine.postsDone);
  const parts = [
    routine.emailsDone ? `Handled ${emailCount} emails` : "Email handling pending",
    routine.groupsDone ? "checked 3 groups" : "group check pending",
    routine.postsDone ? `published ${postCount} posts` : "post publishing pending",
  ];
  return {
    taskName: dailyRoutineTaskName(),
    nextAction: "",
    workLog: `[JL] Daily Routine: ${parts.join("; ")}.`,
    category: "Julia",
    priority: "P2",
    status: isComplete ? "Done" : "In Progress",
    dueDate: todayIso(),
    sourceDate: todayIso(),
    completedDate: isComplete ? todayIso() : "",
    needsReview: false,
  };
}

function upsertTaskInData(data, task) {
  const matches = (candidate) => {
    if (task.sourceId && candidate.sourceId === task.sourceId) return true;
    return normalizeEscapedText(candidate.taskName) === normalizeEscapedText(task.taskName) && candidate.dueDate === task.dueDate;
  };
  const index = data.tasks.findIndex(matches);
  if (index >= 0) {
    data.tasks[index] = { ...data.tasks[index], ...task };
  } else {
    data.tasks = [task, ...data.tasks];
  }
}

async function saveDailyRoutineToNotion(data, routine) {
  const existingTask = findDailyRoutineTask(data);
  const task = {
    ...dailyRoutineTaskPayload(routine),
    sourceId: existingTask?.sourceId || routine.sourceId || "",
    sourceType: existingTask?.sourceType || routine.sourceType || "workflow-task",
    notionUrl: existingTask?.notionUrl || routine.notionUrl || "",
  };

  const result = task.sourceId ? await saveTaskEdit(task) : await saveTaskToNotion(task);
  const savedTask = {
    ...task,
    ...(result.task || {}),
    sourceId: result.sourceId || result.task?.sourceId || task.sourceId,
    sourceType: result.sourceType || result.task?.sourceType || "workflow-task",
    notionUrl: result.notionUrl || result.task?.notionUrl || task.notionUrl,
  };
  upsertTaskInData(data, savedTask);
  saveDailyRoutineState({
    ...routine,
    sourceId: savedTask.sourceId,
    sourceType: savedTask.sourceType,
    notionUrl: savedTask.notionUrl,
  });
  return savedTask;
}

function taskStatusChips(task) {
  const chips = [chip(task.priority, priorityClass(task.priority)), chip(task.status, statusClass(task.status))];
  if (task.dueDate) chips.push(chip(task.dueDate, task.dueDate === todayIso() ? "due-today" : "due-date"));
  if (task.needsReview) chips.push(chip("Review", "status-review"));
  return chips.join("");
}

function taskKey(task) {
  return encodeURIComponent([task.sourceType, task.sourceId, task.taskName, task.dueDate].filter(Boolean).join("|"));
}

function findTaskByKey(data, key) {
  return allTasks(data).find((task) => taskKey(task) === key);
}

function canPatchTask(task) {
  return Boolean(task?.sourceId);
}

function editTaskButton(task, className = "row-edit-action") {
  return `<button class="text-action ${className}" type="button" data-edit-task="${taskKey(task)}">Edit</button>`;
}

function cleanTaskText(text) {
  return displayReportText(text);
}

function formatTaskRecordTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateMonth(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : "";
}

function monthTitle(monthKey) {
  if (!monthKey) return "Current Month";
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" });
}

function formatRangeDate(date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function canonicalWeekLabel(dateText) {
  if (!dateText) return "Unscheduled Week";
  const date = new Date(`${dateText}T00:00:00`);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${formatRangeDate(monday)}-${formatRangeDate(sunday)}`;
}

function parseWeekRangeLabel(label) {
  const match = String(label || "").match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*-\s*(?:(\d{4})[./-])?(\d{1,2})[./-](\d{1,2})/);
  if (!match) return null;
  const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = match;
  const toIso = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    label,
    start: toIso(startYear, startMonth, startDay),
    end: toIso(endYear || startYear, endMonth, endDay),
  };
}

function reportWeekLabel(data, dateText) {
  const ranges = unique((data.dailyExtracts || []).map((item) => item.weekRange))
    .map(parseWeekRangeLabel)
    .filter(Boolean);
  const matched = ranges.find((range) => dateText && dateText >= range.start && dateText <= range.end);
  return matched?.label || canonicalWeekLabel(dateText);
}

function weekLabel(dateText) {
  return canonicalWeekLabel(dateText);
}

function reportSourceText(item) {
  return [
    item.completedWork,
    item.keyOutputs,
    item.inProgress,
    item.followUps,
    item.risksIssues,
    item.tomorrowReminders,
    item.weeklyReportCandidate,
    item.notes,
    item.workLog,
    item.taskName,
    item.nextAction,
    item.category,
  ]
    .filter(Boolean)
    .join("；");
}

function reportQuantity(text) {
  const matches = [...String(text).matchAll(/(\d+)\s*(条|份|次|个|版|项|篇|张)/g)];
  if (!matches.length) return 1;
  return matches.reduce((total, match) => total + Number(match[1]), 0);
}

function explicitQuantity(text) {
  const matches = [...String(text).matchAll(/(\d+)\s*(条|份|次|个|版|项|篇|张|posts?|videos?|issues?|tasks?|files?)/gi)];
  return matches.reduce((total, match) => total + Number(match[1]), 0);
}

function uniqueReportItems(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function reportTags(text) {
  return [...String(text).matchAll(/\\?\[([^\]\\]+)\\?\]/g)].map((match) => match[1].trim().toLowerCase());
}

function tagAliases(tags) {
  const aliases = new Set(tags.map((tag) => tag.toLowerCase()));
  for (const group of WORKFLOW_TAG_GROUPS) {
    const groupAliases = group.aliases.map((tag) => tag.toLowerCase());
    if (groupAliases.some((tag) => aliases.has(tag))) {
      groupAliases.forEach((tag) => aliases.add(tag));
    }
  }
  return aliases;
}

function hasReportTag(item, tags) {
  const itemTags = reportTags(item.text);
  const aliases = tagAliases(tags);
  return itemTags.some((tag) => aliases.has(tag));
}

function displayReportText(text) {
  return String(text || "")
    .replace(/\\+\[/g, "[")
    .replace(/\\+\]/g, "]")
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/^\\+/, "")
    .trim();
}

function cleanSummaryText(text) {
  return displayReportText(text)
    .replace(/\[[^\]]*https?:\/\/[^\]]+\]\(https?:\/\/[^\s)]+\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "")
    .replace(/\*\*/g, "")
    .replace(/\bMessaeg\b/gi, "Message")
    .replace(/\bMesseag\b/gi, "Message")
    .replace(/\bHandel\b/gi, "Handle")
    .replace(/\s+/g, " ")
    .replace(/^[，,；;。.\s]+|[，,；;。.\s]+$/g, "")
    .trim();
}

function isStandaloneSummaryNoise(text) {
  return /^(Meeting|Product|User Feedback|Content|Data|Other)$/i.test(cleanSummaryText(text));
}

function summaryThemeLabel(text) {
  const value = cleanSummaryText(text);
  if (/message|sms|beta|firmware|ax\.?25|bluetooth|ha2|h1 calllog|call log/i.test(value)) return "Message / SMS function";
  if (/用户|user|customer|issue|问题|反馈|email|amazon|calibration|频|interference|hd1|ma1|rv\d+|rt\d+|lr\d+/i.test(value)) return "User issues / feedback";
  if (/video|post|blog|图片|pic|素材|白底图|拍摄|剪辑|发布|script|直播|exhibition|展会/i.test(value)) return "Content / assets";
  if (/需求|requirement|pm|pmo|研发|r&d|提交|管理/i.test(value)) return "Requirement management";
  if (/imc|标签|research|analysis|report|汇报|数据分析|周例会|meeting/i.test(value)) return "Reporting / alignment";
  return "Other completed work";
}

function summarizeReportItems(items, emptyText) {
  const grouped = new Map();
  for (const item of uniqueReportItems(items.map(cleanSummaryText)).filter((value) => value && !isStandaloneSummaryNoise(value))) {
    const label = summaryThemeLabel(item);
    grouped.set(label, [...(grouped.get(label) || []), item]);
  }

  if (!grouped.size) return emptyText;

  return [...grouped.entries()]
    .map(([label, values]) => {
      const recordCountLabel = `${values.length} record${values.length === 1 ? "" : "s"}`;
      return [
        `${label} (${recordCountLabel})`,
        ...values.map((value) => `- ${value}`),
      ].join("\n");
    })
    .join("\n\n");
}

function isOngoingRecord(item) {
  return item.weekday === "This Week Ongoing" || /weekly-level ongoing/i.test(item.notes || "");
}

function recordItems(item) {
  const completedText = [item.completedWork, item.keyOutputs].filter(Boolean).join("；");
  const openText = [item.inProgress, item.followUps, item.risksIssues, item.tomorrowReminders, item.notes]
    .filter((value) => value && !/weekly-level ongoing/i.test(value))
    .join("；");
  const fallbackText = !completedText && !openText ? item.weeklyReportCandidate : "";
  return [
    ...splitText(completedText || fallbackText).map((text) => ({
      date: item.date,
      week: item.weekRange || canonicalWeekLabel(item.date),
      weekday: item.weekday,
      text,
      type: isOngoingRecord(item) ? "ongoing" : "daily",
      done: true,
    })),
    ...splitText(openText).map((text) => ({
      date: item.date,
      week: item.weekRange || canonicalWeekLabel(item.date),
      weekday: item.weekday,
      text,
      type: isOngoingRecord(item) ? "ongoing" : "daily",
      done: false,
    })),
  ];
}

function itemMatches(item, tags, keywords) {
  return hasReportTag(item, tags) || keywords.test(item.text);
}

function hasAnyTag(item, tags) {
  return hasReportTag(item, tags);
}

function isWaitingOrTbdItem(item) {
  return hasAnyTag(item, ["TBD", "Waiting"]) || /TBD|waiting|wait|等待|待确认|待完成|待跟进|待同步|待提交|待刷新|待更新|待重新/i.test(item.text);
}

function isProgressItem(item) {
  if (isWaitingOrTbdItem(item)) return false;
  return hasAnyTag(item, ["Progress"]) || (!item.done && !hasAnyTag(item, ["Plan", "Idea"]));
}

function isQuantifiedOutputItem(item) {
  return item.done || hasAnyTag(item, ["Output", "Done"]) || explicitQuantity(item.text) > 0;
}

function reportSection(title, items) {
  const uniqueItems = uniqueReportItems(items.map((item) => displayReportText(item.text))).slice(0, 6);
  const quantifiedItems = uniqueReportItems(
    items
      .filter((item) => explicitQuantity(item.text) > 0)
      .map((item) => `${displayReportText(item.text)} (${explicitQuantity(item.text)})`),
  );
  return {
    title,
    total: items.reduce((sum, item) => sum + reportQuantity(item.text), 0),
    records: items.length,
    quantifiedOutput: items.reduce((sum, item) => sum + explicitQuantity(item.text), 0),
    quantifiedItems,
    items: uniqueItems,
  };
}

function workflowSections(items) {
  const productLine = items.filter((item) => itemMatches(item, REPORT_LINES[0].tags, REPORT_LINES[0].keywords));
  const brand = items.filter((item) => itemMatches(item, REPORT_LINES[1].tags, REPORT_LINES[1].keywords));
  const imc = items.filter((item) => itemMatches(item, REPORT_LINES[2].tags, REPORT_LINES[2].keywords));
  const julia = items.filter((item) => hasReportTag(item, ["JULIA"]));
  const nextMoves = items.filter(
    (item) => hasReportTag(item, ["Plan", "Idea", "TBD"]) || (!item.done && !hasReportTag(item, ["JULIA"])),
  );

  return [
    reportSection("Product Line", productLine),
    reportSection("Brand", brand),
    reportSection("IMC", imc),
    reportSection("Julia’s Initiative", julia),
    reportSection("Next Moves", nextMoves),
  ];
}

function lineReport(line, items) {
  const lineItems = items.filter((item) => itemMatches(item, line.tags, line.keywords));
  const quantifiedItems = uniqueReportItems(
    lineItems
      .filter((item) => isQuantifiedOutputItem(item) && !isWaitingOrTbdItem(item))
      .map((item) => displayReportText(item.text)),
  );
  const progressItems = uniqueReportItems(
    lineItems
      .filter(isProgressItem)
      .map((item) => displayReportText(item.text)),
  );
  const waitingItems = uniqueReportItems(
    lineItems
      .filter(isWaitingOrTbdItem)
      .map((item) => displayReportText(item.text)),
  );
  const quantifiedOutput = lineItems
    .filter((item) => isQuantifiedOutputItem(item) && !isWaitingOrTbdItem(item))
    .reduce((sum, item) => sum + explicitQuantity(item.text), 0);

  return {
    title: line.title,
    records: lineItems.length,
    quantifiedOutput,
    quantifiedItems,
    progressItems,
    waitingItems,
    summary: lineSummaryText(line.title, {
      records: lineItems.length,
      quantifiedOutput,
      quantifiedItems,
      progressItems,
      waitingItems,
    }),
  };
}

function lineSummaryText(title, details) {
  const output = details.quantifiedOutput
    ? `${details.quantifiedOutput} quantified output`
    : `${details.records} tracked records`;
  return [
    `${title}: ${details.records} records, ${output}.`,
    `Key Completed Work: ${summarizeReportItems(details.quantifiedItems, "No completed output captured yet.")}.`,
    `In Progress: ${summarizeReportItems(details.progressItems, "No active progress records captured yet.")}.`,
    `Waiting / TBD: ${summarizeReportItems(details.waitingItems, "No waiting or TBD records captured yet.")}.`,
  ].join("\n");
}

function weeklyExecutiveSummary(lines) {
  return lines.map((line) => line.summary);
}

function summaryDraftKey(report, lineTitle) {
  return `daily-work-weekly-summary:${report.week || "current"}:${lineTitle}`;
}

function summaryFieldKey(report, lineTitle, field) {
  return `${summaryDraftKey(report, lineTitle)}:${field}`;
}

function summaryFieldDefaults(line) {
  const output = line.quantifiedOutput
    ? `${line.quantifiedOutput} quantified output`
    : `${line.records} tracked records`;
  return {
    overview: `${line.title}: ${line.records} records, ${output}.`,
    completed: summarizeReportItems(line.quantifiedItems, "No completed output captured yet."),
    progress: summarizeReportItems(line.progressItems, "No active progress records captured yet."),
    waiting: summarizeReportItems(line.waitingItems, "No waiting or TBD records captured yet."),
  };
}

function summaryFieldValue(report, line, field) {
  try {
    return localStorage.getItem(summaryFieldKey(report, line.title, field)) || summaryFieldDefaults(line)[field] || "";
  } catch {
    return summaryFieldDefaults(line)[field] || "";
  }
}

function latestReportMonth(data) {
  const dates = [
    ...data.dailyExtracts.map((item) => item.date),
    ...data.tasks.flatMap((task) => [task.sourceDate, task.completedDate, task.dueDate]),
  ].filter(dateMonth);
  return dates.sort().at(-1)?.slice(0, 7) || todayIso().slice(0, 7);
}

function reportItemsForMonth(data, monthKey) {
  const dailyItems = data.dailyExtracts
    .filter((item) => dateMonth(item.date) === monthKey)
    .flatMap(recordItems);

  const taskItems = data.tasks
    .filter((task) => task.sourceType !== "daily-work")
    .map((task) => {
      const date = task.sourceDate || task.completedDate || task.dueDate;
      return {
        date,
        week: reportWeekLabel(data, date),
        text: isWorkflowOngoingTask(task) ? workflowOngoingReportText(task) : reportSourceText(task),
        type: isWorkflowOngoingTask(task) ? "ongoing" : "task",
        done: isDone(task),
      };
    })
    .filter((item) => dateMonth(item.date) === monthKey);

  return [...dailyItems, ...taskItems].filter((item) => item.text);
}

function leadershipWeekReport(week, items, weekly) {
  const openFollowUps = uniqueReportItems([
    ...splitText(weekly.continuedFollowUps),
    ...items.filter((item) => !item.done).flatMap((item) => splitText(item.text)),
  ]).slice(0, 4);

  const reportItems = [
    ...items,
    ...openFollowUps.map((text) => ({ text: `[TBD] ${text}`, done: false })),
    ...splitText(weekly.nextWeekPlan).map((text) => ({ text: `[Plan] ${text}`, done: false })),
  ];
  const lines = REPORT_LINES.map((line) => lineReport(line, reportItems));

  return {
    week,
    startDate: items.map((item) => item.date).filter(Boolean).sort()[0] || "",
    total: items.reduce((total, item) => total + reportQuantity(item.text), 0),
    records: items.length,
    quantifiedOutput: items.reduce((total, item) => total + explicitQuantity(item.text), 0),
    quantifiedItems: uniqueReportItems(
      items
        .filter((item) => explicitQuantity(item.text) > 0)
        .map((item) => `${displayReportText(item.text)} (${explicitQuantity(item.text)})`),
    ),
    items,
    lines,
    executiveSummary: weeklyExecutiveSummary(lines),
    sections: workflowSections(reportItems),
  };
}

function monthlyLeadershipReport(data) {
  const monthKey = latestReportMonth(data);
  const items = reportItemsForMonth(data, monthKey);
  const grouped = new Map();
  for (const item of items) {
    const key = item.week || weekLabel(item.date);
    grouped.set(key, [...(grouped.get(key) || []), item]);
  }

  const weekly = data.weeklyReview || {};
  const weeks = [...grouped.entries()]
    .map(([week, items]) => leadershipWeekReport(week, items, weekly))
    .sort((left, right) => right.startDate.localeCompare(left.startDate));

  return {
    monthKey,
    title: monthTitle(monthKey),
    weeks,
    recap: monthlyRecap(weeks),
    sourceNote: "Daily Work todo records and Workflow Tasks rows can be edited from the Tasks view.",
  };
}

function monthlyRecap(weeks) {
  const sectionNames = ["Product Line", "Brand", "IMC", "Julia’s Initiative", "Next Moves"];
  const sections = sectionNames.map((name) => {
    const weekSections = weeks.flatMap((week) => week.sections.filter((section) => section.title === name));
    return {
      title: name,
      total: weekSections.reduce((sum, section) => sum + section.total, 0),
      records: weekSections.reduce((sum, section) => sum + section.records, 0),
      quantifiedOutput: weekSections.reduce((sum, section) => sum + section.quantifiedOutput, 0),
      quantifiedItems: uniqueReportItems(weekSections.flatMap((section) => section.quantifiedItems)),
      items: uniqueReportItems(weekSections.flatMap((section) => section.items)),
    };
  });
  const allItems = weeks.flatMap((week) => week.items || []);
  const quantifiedItems = uniqueReportItems(weeks.flatMap((week) => week.quantifiedItems));
  const ongoingProjects = uniqueReportItems(
    allItems
      .filter((item) => item.type === "ongoing")
      .map((item) => displayReportText(item.text)),
  );
  const leadershipSummary = sections
    .filter((section) => section.items.length)
    .map((section) => `${section.title}: ${section.items.slice(0, 4).join("；")}`);
  return {
    weekCount: weeks.length,
    total: weeks.reduce((sum, week) => sum + week.total, 0),
    records: weeks.reduce((sum, week) => sum + week.records, 0),
    quantifiedOutput: weeks.reduce((sum, week) => sum + week.quantifiedOutput, 0),
    quantifiedItems,
    ongoingProjects,
    leadershipSummary,
    sections,
  };
}

function selectedWeeklyReport(monthly) {
  if (!monthly.weeks.length) return null;
  const selected = monthly.weeks.find((week) => week.week === state.selectedWeek);
  return selected || monthly.weeks[0];
}

function weeklyOngoingItems(data, weekRange) {
  const dailyOngoing = data.dailyExtracts
    .filter((item) => item.weekRange === weekRange && isOngoingRecord(item))
    .flatMap(recordItems)
    .filter((item) => item.text);
  const taskOngoing = data.tasks
    .filter((task) => {
      const date = task.sourceDate || task.completedDate || task.dueDate;
      return isWorkflowOngoingTask(task) && reportWeekLabel(data, date) === weekRange;
    })
    .map((task) => {
      const date = task.sourceDate || task.completedDate || task.dueDate;
      return {
        date,
        week: reportWeekLabel(data, date),
        text: workflowOngoingReportText(task),
        type: "ongoing",
        done: isDone(task),
        task: task,
      };
    });
  return [...dailyOngoing, ...taskOngoing].filter((item) => item.text);
}

function dailyRecordGroups(data, weekRange) {
  const groups = new Map();
  for (const item of data.dailyExtracts) {
    if (item.weekRange !== weekRange || isOngoingRecord(item)) continue;
    const records = recordItems(item).filter((record) => record.text);
    if (!records.length) continue;
    const key = `${item.date}|${item.weekday}`;
    groups.set(key, {
      date: item.date,
      weekday: item.weekday,
      records: [...(groups.get(key)?.records || []), ...records],
    });
  }
  return [...groups.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function weekFilter(monthly, selectedReport) {
  if (monthly.weeks.length <= 1) return "";
  return `
    <label class="week-filter">
      <span>Report Week</span>
      <select data-week-filter>
        ${monthly.weeks
          .map(
            (report) => `
              <option value="${escapeHtml(report.week)}" ${report.week === selectedReport.week ? "selected" : ""}>
                ${escapeHtml(report.week)}
              </option>
            `,
          )
          .join("")}
      </select>
    </label>
  `;
}

function metricCard(label, value, caption, icon, isReview = false) {
  return `
    <article class="metric-card ${isReview ? "is-review" : ""}">
      <div class="metric-icon" aria-hidden="true">${icon}</div>
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
        <p>${caption}</p>
      </div>
    </article>
  `;
}

function actionHero() {
  return `
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">Julia's Workflow System</p>
        <h1><span>Daily Work</span><span>Command Center</span></h1>
        <p class="hero-subtitle">A private workflow board for tasks, notes, and weekly follow-ups.</p>
      </div>
    </section>
  `;
}

function taskRow(task, index) {
  const taskTitle = cleanTaskText(task.taskName || "Untitled task") || "Untitled task";
  const taskDetail = cleanTaskText(task.nextAction || task.category || "Confirm next action") || "Confirm next action";
  return `
    <article class="focus-row">
      <span class="row-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="focus-copy">
        <h3>${escapeHtml(taskTitle)}</h3>
        <p>${escapeHtml(taskDetail)}</p>
      </div>
      <div class="focus-actions">
        <div class="focus-stamps">${taskStatusChips(task)}</div>
        ${editTaskButton(task, "focus-edit-action")}
      </div>
    </article>
  `;
}

function overviewWeeklyDraft(report) {
  if (!report) return '<p class="muted">No weekly draft captured yet.</p>';
  const sections = report.sections
    .filter((section) => section.items.length)
    .map(
      (section) => `
        <section class="draft-summary-section">
          <h4>${escapeHtml(section.title)}</h4>
          <ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
      `,
    )
    .join("");
  const quantified = report.quantifiedItems.length
    ? `<section class="draft-summary-section"><h4>Quantified Output</h4><ul>${report.quantifiedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`
    : "";
  return `
    <div class="draft-summary">
      <div class="draft-summary-metrics">
        <span>Workload Estimate <strong>${report.total}</strong></span>
        <span>Records <strong>${report.records}</strong></span>
        <span>Quantified Output <strong>${report.quantifiedOutput}</strong></span>
      </div>
      ${sections}
      ${quantified}
    </div>
  `;
}

function ongoingCard(item, index) {
  const task = item.task;
  const title = ongoingDisplayTitle(task, item.text);
  const progress = cleanTaskText(task?.nextAction || item.text) || "No current progress captured yet.";
  const stamps = task
    ? [chip(task.category || "Julia", taskToneClass("category", task.category || "Julia").replace("tone-", "")), taskStatusChips(task)].join("")
    : chip(item.done ? "Done" : "In Progress", item.done ? "status-done" : "status-progress");
  const actions = item.task ? `<div class="ongoing-actions">${editTaskButton(item.task, "compact-action")}</div>` : "";
  return `
    <article class="ongoing-item ${item.done ? "is-done" : ""}">
      <span class="ongoing-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="ongoing-item-copy">
        <h3>${escapeHtml(title)}</h3>
        <p class="ongoing-item-progress"><strong>Current Progress</strong>${escapeHtml(progress)}</p>
        <div class="ongoing-item-stamps">${stamps}</div>
      </div>
      ${actions}
    </article>
  `;
}

function dailyRecordGroup(group) {
  const items = uniqueReportItems(group.records.map((item) => displayReportText(item.text))).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `
    <details class="daily-record-group">
      <summary>
        <span>${escapeHtml(group.weekday)}</span>
        <strong>${escapeHtml(group.date)}</strong>
      </summary>
      <ul>${items}</ul>
    </details>
  `;
}

function renderOverview(data) {
  const openTasks = countBy(data.tasks, (task) => !isDone(task));
  const reviewTasks = countBy(data.tasks, (task) => task.needsReview || String(task.status).includes("Review"));
  const latestDaily = data.dailyExtracts[data.dailyExtracts.length - 1] || {};
  const focusTasks = data.todayFocus.slice(0, 3);
  const monthly = monthlyLeadershipReport(data);
  const selectedReport = selectedWeeklyReport(monthly);
  const ongoingItems = weeklyOngoingItems(data, selectedReport?.week || data.weeklyReview.weekRange).slice(0, 6);
  const dailyGroups = dailyRecordGroups(data, selectedReport?.week || data.weeklyReview.weekRange);

  elements.overview.innerHTML = `
    ${actionHero()}
    <section class="metric-grid">
      ${metricCard("Focus Items", data.todayFocus.length, "This week, overdue, review", "◎")}
      ${metricCard("Open Tasks", openTasks, "In progress", "☷")}
      ${metricCard("Needs Review", reviewTasks, "Check these first", "!", true)}
      ${metricCard("Weekly Draft", data.weeklyReview.weekRange ? 1 : 0, "Ready to refine", "✓")}
    </section>

    <section class="work-grid">
      <article class="zine-panel focus-panel">
        <div class="panel-title-row">
          <h2><span>Focus Items</span></h2>
          <button class="text-action" type="button" data-jump-view="tasks">View all tasks</button>
        </div>
        <div class="focus-list">
          ${focusTasks.length ? focusTasks.map(taskRow).join("") : '<p class="empty">No high-impact tasks for now.</p>'}
        </div>
      </article>

      <aside class="side-stack">
        <article class="zine-panel notes-panel">
          <div class="panel-title-row">
            <h2><span>This Week Ongoing</span></h2>
          </div>
          <div class="ongoing-list">
            ${ongoingItems.length ? ongoingItems.map(ongoingCard).join("") : '<p class="empty">No weekly ongoing items captured yet.</p>'}
          </div>
        </article>

        <article class="zine-panel draft-panel">
          <div class="panel-title-row">
            <h2><span>Weekly Draft</span></h2>
            <button class="text-action" type="button" data-jump-view="weekly">Open draft</button>
          </div>
          <h3>${escapeHtml(selectedReport?.week || data.weeklyReview.weekRange || "Current week")}</h3>
          ${overviewWeeklyDraft(selectedReport)}
          <div class="progress-line" aria-hidden="true"><span></span></div>
        </article>
      </aside>
    </section>
    <section class="lower-grid">
      <article class="zine-panel daily-records-panel">
        <div class="panel-title-row">
          <h2><span>Daily Records</span></h2>
          <button class="text-action" type="button" data-jump-view="weekly">Open report</button>
        </div>
        <div class="daily-record-list">
          ${dailyGroups.length ? dailyGroups.map(dailyRecordGroup).join("") : '<p class="empty">No daily records captured for this week yet.</p>'}
        </div>
      </article>
    </section>
    ${taskEditForm(data)}
  `;

  bindJumpButtons();
  bindTaskEditor(data, elements.overview);
  bindEditTaskButtons(data, elements.overview);
}

function filterSelect(label, key, values) {
  return `
    <label>
      <span>${label}</span>
      <select data-filter="${key}">
        <option value="All">All</option>
        ${values.map((value) => `<option value="${escapeHtml(value)}" ${state.filters[key] === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
      </select>
    </label>
  `;
}

function filterWeekSelect(tasks) {
  const weeks = unique(
    tasks
      .map((task) => task.dueDate || task.sourceDate || task.completedDate)
      .filter(Boolean)
      .map(canonicalWeekLabel),
  );
  return filterSelect("Report Week", "week", weeks);
}

function filteredTasks(data) {
  return allTasks(data).filter((task) => {
    const taskWeek = canonicalWeekLabel(task.dueDate || task.sourceDate || task.completedDate);
    return (
      (state.filters.week === "All" || taskWeek === state.filters.week) &&
      (state.filters.priority === "All" || task.priority === state.filters.priority) &&
      (state.filters.status === "All" || task.status === state.filters.status) &&
      (state.filters.category === "All" || task.category === state.filters.category)
    );
  });
}

function inlineSelect(task, field, values) {
  if (!canPatchTask(task)) {
    if (field === "priority") return chip(task.priority, priorityClass(task.priority));
    if (field === "status") return chip(task.status, statusClass(task.status));
    return escapeHtml(task[field] || "—");
  }

  return `
    <span class="direct-edit-cell">
    <select class="inline-task-select ${taskToneClass(field, task[field])}" data-inline-field="${field}" data-task-key="${taskKey(task)}" aria-label="Edit ${field}">
      ${unique([...values, task[field]].filter(Boolean))
        .map((value) => `<option value="${escapeHtml(value)}" ${task[field] === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
        .join("")}
    </select>
    </span>
  `;
}

function taskRowMeta(task) {
  const taskTitle = cleanTaskText(task.taskName);
  const nextAction = cleanTaskText(task.nextAction);
  if (!nextAction || nextAction === taskTitle) return "";
  return `<em class="task-row-meta">${escapeHtml(nextAction)}</em>`;
}

function taskTable(tasks, taskPool) {
  const categoryOptions = unique([...DEFAULT_TASK_CATEGORIES, ...taskPool.map((task) => task.category)]);
  const priorityOptions = unique([...taskPool.map((task) => task.priority), "P1", "P2", "P3"]);
  const statusOptions = unique([...taskPool.map((task) => task.status), "Not Started", "In Progress", "Waiting on Others", "Done"]);

  return `
      <div class="table-panel">
      <div class="table-row table-head">
        <span>Task</span><span>Category</span><span>Priority</span><span>Status</span><span>Due</span><span>Next Action</span><span>Edit</span>
      </div>
      ${
        tasks.length
          ? tasks
              .map(
                (task) => `
                  <div class="table-row">
                    <span class="task-row-main">
                      ${task.recordTime ? `<em class="task-row-time">${escapeHtml(formatTaskRecordTime(task.recordTime))}</em>` : ""}
                      <strong class="task-row-title">${escapeHtml(cleanTaskText(task.taskName))}</strong>
                      ${taskRowMeta(task)}
                      ${task.isLocalDraft ? '<em class="local-task-mark">Kept as local draft</em>' : ""}
                      ${task.notionUrl ? '<em class="local-task-mark">Saved to Workflow Tasks</em>' : ""}
                    </span>
                    <span>${inlineSelect(task, "category", categoryOptions)}</span>
                    <span>${inlineSelect(task, "priority", priorityOptions)}</span>
                    <span>${inlineSelect(task, "status", statusOptions)}</span>
                    <span>${escapeHtml(task.dueDate || "—")}</span>
                    <span class="task-row-next">${escapeHtml(cleanTaskText(task.nextAction || "—"))}</span>
                    <span>${editTaskButton(task, "compact-action")}</span>
                  </div>
                `,
              )
              .join("")
          : '<p class="empty">No tasks match these filters.</p>'
      }
    </div>
  `;
}

function taskForm(data) {
  return `
    <dialog class="task-dialog" id="task-dialog">
      <form method="dialog" class="task-form" id="task-form">
        <div class="task-form-header">
          <div>
            <p>Workflow Tasks</p>
            <h2>New Task</h2>
          </div>
          <button class="icon-button dialog-close" type="button" data-close-task aria-label="Close new task form">×</button>
        </div>
        <p class="task-form-note">Save a new task to the Workflow Tasks Notion database. Existing Daily Work todo records can be edited from the task list.</p>
        <label>
          <span>Task Name</span>
          <input name="taskName" required placeholder="What needs to be done?" />
        </label>
        <label>
          <span>Next Action</span>
          <textarea name="nextAction" rows="3" placeholder="Add the concrete next step"></textarea>
        </label>
        <div class="task-form-grid">
          <label>
            <span>Category</span>
            <select name="category">
              ${taskCategoryOptions(data)}
            </select>
          </label>
          <label>
            <span>Due Date</span>
            <input name="dueDate" type="date" />
          </label>
          <label>
            <span>Priority</span>
            <select name="priority">
              ${unique([...data.tasks.map((task) => task.priority), "P1", "P2", "P3"]).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select name="status">
              ${unique([...data.tasks.map((task) => task.status), "Not Started", "In Progress", "Waiting on Others", "Done"]).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
            </select>
          </label>
        </div>
        <label class="task-form-check">
          <input name="needsReview" type="checkbox" />
          <span>Mark for review</span>
        </label>
        <p class="task-form-hint">Flags this item in Focus Items and Needs Review.</p>
        <div class="task-form-actions">
          <button class="text-action" type="button" data-close-task>Cancel</button>
          <button class="text-action primary-action" type="submit">Save to Notion</button>
        </div>
        <p class="task-save-status" data-task-save-status></p>
      </form>
    </dialog>
  `;
}

function taskEditForm(data) {
  return `
    <dialog class="task-dialog" id="task-edit-dialog">
      <form method="dialog" class="task-form" id="task-edit-form">
        <div class="task-form-header">
          <div>
            <p>Editable record</p>
            <h2>Edit Task</h2>
          </div>
          <button class="icon-button dialog-close" type="button" data-close-edit-task aria-label="Close edit task form">×</button>
        </div>
        <p class="task-form-note" data-edit-source-note>Update this item in Notion.</p>
        <input name="sourceId" type="hidden" />
        <input name="sourceType" type="hidden" />
        <label>
          <span>Task Name</span>
          <textarea name="taskName" rows="3" required></textarea>
        </label>
        <label>
          <span>Next Action</span>
          <textarea name="nextAction" rows="3"></textarea>
        </label>
        <div class="task-form-grid">
          <label>
            <span>Category</span>
            <select name="category">
              ${taskCategoryOptions(data)}
            </select>
          </label>
          <label>
            <span>Due Date</span>
            <input name="dueDate" type="date" />
          </label>
          <label>
            <span>Priority</span>
            <select name="priority">
              ${unique([...data.tasks.map((task) => task.priority), "P1", "P2", "P3"]).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select name="status">
              ${unique([...data.tasks.map((task) => task.status), "Not Started", "In Progress", "Waiting on Others", "Done"]).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
            </select>
          </label>
        </div>
        <label class="task-form-check">
          <input name="needsReview" type="checkbox" />
          <span>Mark for review</span>
        </label>
        <p class="task-form-hint">Flags this item in Focus Items and Needs Review.</p>
        <div class="task-form-actions">
          <button class="text-action" type="button" data-close-edit-task>Cancel</button>
          <button class="text-action primary-action" type="submit">Save changes</button>
        </div>
        <p class="task-save-status" data-edit-save-status></p>
      </form>
    </dialog>
  `;
}

async function saveTaskToNotion(task) {
  const response = await fetch("/api/notion/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not save task to Notion.");
  }
  return payload;
}

async function saveTaskEdit(task) {
  if (!canPatchTask(task)) {
    const created = await saveTaskToNotion(task);
    return {
      ...created,
      task: {
        ...task,
        sourceId: created.sourceId || "",
        sourceType: created.sourceType || "workflow-task",
        notionUrl: created.notionUrl || "",
      },
    };
  }
  const endpoint = task.sourceType === "daily-work" ? "/api/notion/daily-work" : "/api/notion/tasks";
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  const payload = await response.clone().json().catch(async () => ({ error: await response.text().catch(() => "") }));
  if (!response.ok) {
    throw new Error(payload.error || "Could not update this item in Notion.");
  }
  return payload;
}

function replaceTaskInState(data, updatedTask, originalKey = "") {
  let replaced = false;
  const replace = (task) => {
    const matchesOriginal = originalKey && taskKey(task) === originalKey;
    const matchesUpdated = taskKey(task) === taskKey(updatedTask);
    const matchesSource = task.sourceId && task.sourceId === updatedTask.sourceId;
    if (!matchesOriginal && !matchesUpdated && !matchesSource) return task;
    replaced = true;
    return { ...task, ...updatedTask };
  };
  data.tasks = data.tasks.map(replace);
  state.localTasks = state.localTasks.map(replace);
  if (!replaced) {
    state.localTasks = [updatedTask, ...state.localTasks];
  }
}

async function updateInlineTaskField(data, select) {
  const task = findTaskByKey(data, select.dataset.taskKey);
  const field = select.dataset.inlineField;
  if (!task || !field) return;

  const previousValue = task[field];
  const updatedTask = { ...task, [field]: select.value };
  select.disabled = true;
  try {
    await saveTaskEdit(updatedTask);
    replaceTaskInState(data, updatedTask);
    renderTasks(data);
  } catch (error) {
    select.value = previousValue;
    showState(error instanceof Error ? error.message : "Could not update this item in Notion.", "error");
  } finally {
    select.disabled = false;
  }
}

function fillTaskEditForm(form, task) {
  form.elements.sourceId.value = task.sourceId || "";
  form.elements.sourceType.value = task.sourceType || "";
  form.elements.taskName.value = normalizeEscapedText(task.taskName || "");
  form.elements.nextAction.value = normalizeEscapedText(task.nextAction || "");
  form.elements.category.value = normalizeEscapedText(task.category || "Other");
  form.elements.dueDate.value = cleanInputDate(task.dueDate);
  form.elements.priority.value = task.priority || "P2";
  form.elements.status.value = task.status || "Not Started";
  form.elements.needsReview.checked = Boolean(task.needsReview);
}

function bindEditTaskButtons(data, root = document) {
  root.querySelectorAll("[data-edit-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = findTaskByKey(data, button.dataset.editTask);
      const dialog = root.querySelector("#task-edit-dialog");
      const form = root.querySelector("#task-edit-form");
      const note = root.querySelector("[data-edit-source-note]");
      if (!task || !dialog || !form) return;
      form.dataset.taskKey = taskKey(task);
      fillTaskEditForm(form, task);
      if (note) {
        note.textContent =
          task.sourceType === "daily-work"
            ? "This edits the original Daily Work todo block in Notion."
            : task.sourceId
              ? "This edits the Workflow Tasks database row in Notion."
              : "This record has no source id, so saving will create a Workflow Tasks row.";
      }
      dialog.showModal();
    });
  });
}

function bindTaskEditor(data, root = document) {
  const dialog = root.querySelector("#task-edit-dialog");
  const form = root.querySelector("#task-edit-form");
  const status = root.querySelector("[data-edit-save-status]");
  root.querySelectorAll("[data-close-edit-task]").forEach((button) => {
    button.addEventListener("click", () => dialog?.close());
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const originalKey = form.dataset.taskKey;
    const original = findTaskByKey(data, originalKey) || {};
    const originalWasPatchable = canPatchTask(original);
    const task = taskFromEditForm(form, original);
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    if (status) status.textContent = "Saving changes to Notion...";
    try {
      const result = await saveTaskEdit(task);
      const savedTask = result.task || task;
      replaceTaskInState(data, savedTask, originalKey);
      if (!originalWasPatchable && canPatchTask(savedTask)) {
        rememberHiddenSourceTask(originalKey);
      }
      if (status) status.textContent = "Saved.";
      dialog?.close();
      render();
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Notion update failed.";
    } finally {
      submit.disabled = false;
    }
  });
}

function bindInlineTaskControls(data) {
  elements.tasks.querySelectorAll("[data-inline-field]").forEach((select) => {
    select.addEventListener("change", () => updateInlineTaskField(data, select));
  });
}

function bindTaskCreator(data) {
  const dialog = elements.tasks.querySelector("#task-dialog");
  const form = elements.tasks.querySelector("#task-form");
  const status = elements.tasks.querySelector("[data-task-save-status]");
  elements.tasks.querySelector("[data-open-task]")?.addEventListener("click", () => {
    form?.reset();
    if (form) {
      form.elements.category.value = "Other";
      form.elements.priority.value = "P2";
      form.elements.status.value = "Not Started";
    }
    if (status) status.textContent = "";
    dialog?.showModal();
  });
  elements.tasks.querySelectorAll("[data-close-task]").forEach((button) => {
    button.addEventListener("click", () => dialog?.close());
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type=submit]");
    const task = taskFromForm(form);
    submit.disabled = true;
    if (status) status.textContent = "Saving to Notion...";
    try {
      const result = await saveTaskToNotion(task);
      const savedTask = {
        ...task,
        sourceId: result.sourceId || "",
        sourceType: result.sourceType || "workflow-task",
        notionUrl: result.notionUrl || "",
      };
      upsertTaskInData(data, savedTask);
      if (status) status.textContent = "Saved to Workflow Tasks.";
      dialog?.close();
      renderTasks(data);
    } catch (error) {
      state.localTasks.unshift({
        ...task,
        isLocalDraft: true,
      });
      if (status) status.textContent = `Kept as local draft. ${error instanceof Error ? error.message : "Notion save failed."}`;
      renderTasks(data);
    } finally {
      submit.disabled = false;
    }
  });
}

function dailyRoutinePanel(data) {
  const routine = dailyRoutineStateForData(data);
  const checked = (value) => (value ? "checked" : "");
  return `
    <section class="daily-routine-panel" aria-label="Daily Routine">
      <div class="routine-heading">
        <p>Daily Routine</p>
        <h2>Today’s fixed checks</h2>
        <p class="routine-save-status" data-routine-save-status data-routine-status-wrap>${routine.sourceId ? "Synced to Notion for today." : "Not saved to Notion yet."}</p>
      </div>
      <div class="routine-list">
        <article class="routine-item ${routine.emailsDone ? "is-done" : ""}">
          <label class="routine-check">
            <input type="checkbox" data-routine-field="emailsDone" ${checked(routine.emailsDone)} />
            <span>Handle emails</span>
          </label>
          <input class="routine-number" type="number" min="0" inputmode="numeric" aria-label="Email count" data-routine-field="emailsCount" value="${escapeHtml(routine.emailsCount)}" placeholder="0" />
        </article>
        <article class="routine-item ${routine.groupsDone ? "is-done" : ""}">
          <label class="routine-check">
            <input type="checkbox" data-routine-field="groupsDone" ${checked(routine.groupsDone)} />
            <span>Check 3 groups</span>
          </label>
        </article>
        <article class="routine-item ${routine.postsDone ? "is-done" : ""}">
          <label class="routine-check">
            <input type="checkbox" data-routine-field="postsDone" ${checked(routine.postsDone)} />
            <span>Publish post</span>
          </label>
          <input class="routine-number" type="number" min="0" inputmode="numeric" aria-label="Post count" data-routine-field="postsCount" value="${escapeHtml(routine.postsCount)}" placeholder="0" />
        </article>
      </div>
    </section>
  `;
}

function bindDailyRoutine(data) {
  const panel = elements.tasks.querySelector(".daily-routine-panel");
  if (!panel) return;
  const status = panel.querySelector("[data-routine-save-status]");
  const updateItemState = (control) => {
    const item = control.closest(".routine-item");
    const checkbox = item?.querySelector('input[type="checkbox"]');
    item?.classList.toggle("is-done", Boolean(checkbox?.checked));
  };
  const persistRoutine = async () => {
    const routine = loadDailyRoutineState();
    if (status) status.textContent = "Saving routine to Notion...";
    panel.querySelectorAll("[data-routine-field]").forEach((control) => {
      control.disabled = true;
    });
    try {
      await saveDailyRoutineToNotion(data, routine);
      if (status) status.textContent = "Saved to Notion. Included in reports.";
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Could not save routine to Notion.";
    } finally {
      panel.querySelectorAll("[data-routine-field]").forEach((control) => {
        control.disabled = false;
      });
    }
  };
  panel.querySelectorAll("[data-routine-field]").forEach((control) => {
    control.addEventListener("change", () => {
      const current = loadDailyRoutineState();
      const value = control.type === "checkbox" ? control.checked : control.value;
      saveDailyRoutineState({ ...current, [control.dataset.routineField]: value });
      updateItemState(control);
      persistRoutine();
    });
    control.addEventListener("input", () => {
      if (control.type === "checkbox") return;
      const current = loadDailyRoutineState();
      saveDailyRoutineState({ ...current, [control.dataset.routineField]: control.value });
    });
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        control.blur();
      }
    });
  });
}

function taskBoardWeekRange(data, taskPool) {
  if (state.filters.week !== "All") return state.filters.week;
  void taskPool;
  return reportWeekLabel(data, todayIso());
}

function weekRangeEndDate(weekRange) {
  return parseWeekRangeLabel(weekRange)?.end || todayIso();
}

function ongoingTaskPayload(text, weekRange) {
  const cleaned = normalizeEscapedText(text);
  return {
    taskName: `[JL] Ongoing - ${cleaned}`,
    nextAction: cleaned,
    category: "Julia",
    priority: "P2",
    status: "In Progress",
    dueDate: weekRangeEndDate(weekRange),
    sourceDate: todayIso(),
    completedDate: "",
    needsReview: false,
  };
}

function ongoingDisplayTitle(task, fallbackText = "") {
  const text = normalizeEscapedText(task?.taskName || fallbackText);
  return cleanTaskText(text.replace(/^\[JL\]\s*Ongoing\s*-\s*/i, "")) || "Ongoing work";
}

function taskBoardOngoingPanel(data, taskPool) {
  const weekRange = taskBoardWeekRange(data, taskPool);
  const ongoingItems = weeklyOngoingItems(data, weekRange).slice(0, 6);
  return `
    <section class="task-ongoing-panel" aria-label="This Week Ongoing">
      <div class="routine-heading">
        <p>This Week Ongoing</p>
        <h2>${escapeHtml(weekRange)}</h2>
        <button class="text-action primary-action" type="button" data-open-ongoing>Add Ongoing</button>
      </div>
      <div class="task-ongoing-body">
        <div class="ongoing-list">
          ${ongoingItems.length ? ongoingItems.map(ongoingCard).join("") : '<p class="empty">No weekly ongoing items captured yet.</p>'}
        </div>
        <p class="routine-save-status" data-ongoing-save-status></p>
      </div>
    </section>
  `;
}

function prefillOngoingTaskForm(form, weekRange) {
  form.reset();
  form.elements.taskName.value = "[JL] Ongoing - ";
  form.elements.nextAction.value = "";
  form.elements.category.value = "Julia";
  form.elements.dueDate.value = cleanInputDate(weekRangeEndDate(weekRange));
  form.elements.priority.value = "P2";
  form.elements.status.value = "In Progress";
  form.elements.needsReview.checked = false;
}

function bindOngoingCreator(data) {
  const button = elements.tasks.querySelector("[data-open-ongoing]");
  const dialog = elements.tasks.querySelector("#task-dialog");
  const form = elements.tasks.querySelector("#task-form");
  const status = elements.tasks.querySelector("[data-ongoing-save-status]");
  const taskPool = allTasks(data);
  const weekRange = taskBoardWeekRange(data, taskPool);
  button?.addEventListener("click", () => {
    if (!dialog || !form) return;
    prefillOngoingTaskForm(form, weekRange);
    if (status) status.textContent = "Fill the ongoing details, then save to Notion.";
    dialog.showModal();
    form.elements.taskName.focus();
  });
}

function renderTasks(data) {
  const tasks = filteredTasks(data);
  const taskPool = allTasks(data);
  state.visibleTasks = tasks;
  elements.tasks.innerHTML = `
    <section class="page-kicker">
      <p class="eyebrow">Task Board</p>
      <h1>Track the follow-up.</h1>
    </section>
    <section class="task-toolbar">
      <div class="filters">
        ${filterWeekSelect(taskPool)}
        ${filterSelect("Priority", "priority", unique(taskPool.map((task) => task.priority)))}
        ${filterSelect("Status", "status", unique(taskPool.map((task) => task.status)))}
        ${filterSelect("Category", "category", unique(taskPool.map((task) => task.category)))}
      </div>
      <button class="text-action primary-action" type="button" data-open-task>New Task</button>
    </section>
    ${dailyRoutinePanel(data)}
    ${taskBoardOngoingPanel(data, taskPool)}
    <article class="zine-panel">${taskTable(tasks, taskPool)}</article>
    ${taskForm(data)}
    ${taskEditForm(data)}
  `;

  elements.tasks.querySelectorAll("select").forEach((select) => {
    if (!select.dataset.filter) return;
    select.addEventListener("change", () => {
      state.filters[select.dataset.filter] = select.value;
      renderTasks(data);
    });
  });
  bindDailyRoutine(data);
  bindOngoingCreator(data);
  bindTaskCreator(data);
  bindTaskEditor(data, elements.tasks);
  bindEditTaskButtons(data, elements.tasks);
  bindInlineTaskControls(data);
}

function weeklyBlock(title, value) {
  return `
    <article class="weekly-block">
      <h2><span>${title}</span></h2>
      ${listText(value)}
    </article>
  `;
}

function weeklyList(items, empty) {
  return `<ul>${items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : `<li>${escapeHtml(empty)}</li>`}</ul>`;
}

function weeklyLineSection(line) {
  return `
    <section class="weekly-line-section">
      <header>
        <h3>${escapeHtml(line.title)}</h3>
        <span class="section-count">${line.records}</span>
      </header>
      <div class="weekly-line-grid">
        <div>
          <h4>Quantified Output</h4>
          ${weeklyList(line.quantifiedItems, "No completed output captured yet.")}
        </div>
        <div>
          <h4>In Progress</h4>
          ${weeklyList(line.progressItems, "No active progress records captured yet.")}
        </div>
        <div>
          <h4>Waiting / TBD</h4>
          ${weeklyList(line.waitingItems, "No waiting or TBD records captured yet.")}
        </div>
      </div>
    </section>
  `;
}

function editableExecutiveSummary(report) {
  const lines = report.lines || [];
  if (!lines.length) {
    return '<p class="muted">No executive summary available yet.</p>';
  }

  return lines.map((line) => {
    const key = summaryDraftKey(report, line.title);
    const fields = [
      { id: "overview", label: "Overview", rows: 2 },
      { id: "completed", label: "Key Completed Work", rows: 5 },
      { id: "progress", label: "In Progress", rows: 4 },
      { id: "waiting", label: "Waiting / TBD", rows: 4 },
    ];

    return `
      <article class="summary-edit-item">
        <header>
          <h4>${escapeHtml(line.title)}</h4>
          <p>${line.records} records · ${line.quantifiedOutput} quantified output</p>
        </header>
        <div class="summary-edit-fields">
          ${fields.map((field) => `
            <label class="summary-edit-field">
              <span>${escapeHtml(field.label)}</span>
              <textarea data-summary-field="${escapeHtml(field.id)}" rows="${field.rows}">${escapeHtml(summaryFieldValue(report, line, field.id))}</textarea>
            </label>
          `).join("")}
        </div>
        <div class="summary-edit-actions">
          <button class="text-action" type="button" data-save-summary="${escapeHtml(key)}">Save Summary</button>
          <p class="task-save-status" data-summary-status></p>
        </div>
      </article>
    `;
  }).join("");
}

function weeklyLeadershipCard(report, index) {
  const lineSections = (report.lines || []).map(weeklyLineSection).join("");

  return `
    <article class="weekly-report-card">
      <header class="weekly-report-header">
        <div>
          <p>Leadership Weekly Report</p>
          <h2>${escapeHtml(report.week || `Week ${index + 1}`)}</h2>
        </div>
        <strong><span>Workload Estimate</span>${report.total}</strong>
      </header>
      <div class="report-metric-row">
        <span>Records <strong>${report.records}</strong></span>
        <span>Quantified Output <strong>${report.quantifiedOutput}</strong></span>
      </div>
      <section class="weekly-executive-summary">
        <h3>Executive Summary</h3>
        <p class="weekly-report-summary">Auto-generated from this week's records. Edit any line directly when the summary needs correction.</p>
        <div class="summary-edit-list">${editableExecutiveSummary(report)}</div>
      </section>
      <div class="weekly-report-sections">
        <h3 class="weekly-section-title">Cross-functional Progress</h3>
        ${lineSections}
      </div>
    </article>
  `;
}

function monthlyRecapCard(monthly) {
  const recap = monthly.recap || {
    weekCount: 0,
    total: 0,
    records: 0,
    quantifiedOutput: 0,
    quantifiedItems: [],
    ongoingProjects: [],
    leadershipSummary: [],
    sections: [],
  };
  const list = (items, empty) => `<ul class="monthly-recap-list">${items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : `<li>${escapeHtml(empty)}</li>`}</ul>`;

  return `
    <article class="monthly-recap-card">
      <header>
        <div>
          <p>Monthly Recap</p>
          <h2>${escapeHtml(monthly.title)}</h2>
        </div>
        <strong><span>Workload Estimate</span>${recap.total}</strong>
      </header>
      <div class="monthly-recap-metrics">
        <section class="monthly-recap-item">
          <h3>Records</h3>
          <strong>${recap.records}</strong>
          <p>Total source records captured this month.</p>
        </section>
        <section class="monthly-recap-item">
          <h3>Quantified Output</h3>
          <strong>${recap.quantifiedOutput}</strong>
          <p>Estimated concrete deliverables detected from your notes.</p>
        </section>
        <section class="monthly-recap-item">
          <h3>Ongoing Projects</h3>
          <strong>${recap.ongoingProjects.length}</strong>
          <p>Projects or workstreams repeatedly moved during the month.</p>
        </section>
      </div>
      <p class="weekly-report-summary">This month includes ${recap.weekCount} tracked week${recap.weekCount === 1 ? "" : "s"}. The recap is organized for reporting: records, quantified output, ongoing projects, and a leadership-ready summary.</p>
      <section class="monthly-summary-panel">
        <h3>Leadership Summary</h3>
        ${list(recap.leadershipSummary, "No summary-ready records captured yet.")}
      </section>
      <section class="monthly-summary-panel">
        <h3>Ongoing Projects</h3>
        ${list(recap.ongoingProjects, "No weekly ongoing projects captured yet.")}
      </section>
      <section class="monthly-summary-panel">
        <h3>Quantified Output Details</h3>
        ${monthlyOutputDetails(recap)}
      </section>
    </article>
  `;
}

function monthlyOutputDetails(recap) {
  const lineOrder = ["Product Line", "Brand", "IMC"];
  const sections = lineOrder.map((title) => {
    const section = recap.sections.find((item) => item.title === title) || {
      title,
      quantifiedOutput: 0,
      quantifiedItems: [],
    };
    const items = section.quantifiedItems.length
      ? section.quantifiedItems
      : ["No quantified output detected yet."];

    return `
      <article class="monthly-output-line">
        <header>
          <h4>${escapeHtml(section.title)}</h4>
          <strong>${section.quantifiedOutput}</strong>
        </header>
        <ul class="monthly-recap-list">
          ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </article>
    `;
  });

  return `<div class="monthly-output-grid">${sections.join("")}</div>`;
}

function workflowTagGuide() {
  const items = WORKFLOW_TAG_GROUPS.map(
    (group) => `
      <article class="tag-guide-item">
        <div>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.detail)}</p>
        </div>
        <div class="tag-guide-tags">${group.tags.map((tag) => chip(tag)).join("")}</div>
      </article>
    `,
  ).join("");

  return `
    <article class="tag-guide-card">
      <header>
        <div>
          <p>Tag Guide</p>
          <h2>Short labels for Notion records.</h2>
        </div>
      </header>
      <div class="tag-guide-grid">${items}</div>
    </article>
  `;
}

function renderWeekly(data) {
  const monthly = monthlyLeadershipReport(data);
  const selectedReport = selectedWeeklyReport(monthly);
  elements.weekly.innerHTML = `
    <section class="page-kicker">
      <p class="eyebrow">Monthly Report</p>
      <h1>${escapeHtml(monthly.title)} work summary.</h1>
    </section>
    <section class="monthly-report-shell">
      <div class="monthly-report-note">
        <span>${escapeHtml(monthly.sourceNote)}</span>
        ${selectedReport ? weekFilter(monthly, selectedReport) : ""}
      </div>
      ${workflowTagGuide()}
      ${monthlyRecapCard(monthly)}
      ${
        selectedReport
          ? weeklyLeadershipCard(selectedReport, 0)
          : '<article class="weekly-report-card"><h2>No records for this month yet.</h2><p class="muted">Add daily notes with type, action, quantity, and output so the report can summarize them.</p></article>'
      }
    </section>
  `;

  elements.weekly.querySelector("[data-week-filter]")?.addEventListener("change", (event) => {
    state.selectedWeek = event.target.value;
    renderWeekly(data);
  });
  bindExecutiveSummaryEditor();
}

function bindExecutiveSummaryEditor() {
  elements.weekly.querySelectorAll("[data-save-summary]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".summary-edit-item");
      const fields = [...(item?.querySelectorAll("[data-summary-field]") || [])];
      const status = item?.querySelector("[data-summary-status]");
      if (!fields.length) return;
      try {
        fields.forEach((field) => {
          localStorage.setItem(`${button.dataset.saveSummary}:${field.dataset.summaryField}`, field.value);
        });
        if (status) status.textContent = "Summary saved in this browser.";
      } catch {
        if (status) status.textContent = "Could not save this summary in the browser.";
      }
    });
  });
}

function renderSettings(data) {
  const groups = data.settings || {};
  elements.settings.innerHTML = `
    <section class="page-kicker">
      <p class="eyebrow">Settings</p>
      <h1>System labels.</h1>
    </section>
    <section class="settings-tag-guide">
      ${workflowTagGuide()}
    </section>
    <section class="settings-grid">
      ${Object.entries(groups)
        .map(
          ([name, values]) => `
            <article class="zine-panel setting-group">
              <h2><span>${escapeHtml(name)}</span></h2>
              <div>${values.map((value) => chip(value)).join("") || '<span class="muted">No labels configured.</span>'}</div>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function bindJumpButtons() {
  document.querySelectorAll("[data-jump-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.jumpView;
      render();
    });
  });
}

function render() {
  if (!state.data) return;

  renderOverview(state.data);
  renderTasks(state.data);
  renderWeekly(state.data);
  renderSettings(state.data);

  document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
  document.querySelector(`#${state.activeView}-view`).classList.add("is-active");
  elements.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === state.activeView));
}

function showState(message, type = "") {
  elements.statePanel.textContent = message;
  elements.statePanel.className = `state-panel ${type}`;
}

function setSyncLine(message, type = "") {
  elements.sourceLine.innerHTML = `<span class="sync-dot" aria-hidden="true"></span>${escapeHtml(message)}`;
  elements.sourceLine.className = `sync-pill ${type}`;
}

function setDashboardLocked(locked) {
  elements.authPanel.hidden = !locked;
  document.body.classList.toggle("is-locked", locked);
  elements.statePanel.hidden = locked;
  elements.overview.hidden = locked;
  elements.tasks.hidden = locked;
  elements.weekly.hidden = locked;
  elements.settings.hidden = locked;
}

async function authStatus() {
  const response = await fetch("/api/auth/status");
  if (!response.ok) return { authRequired: false, authenticated: true };
  return response.json();
}

async function login(password) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to unlock dashboard.");
  return payload;
}

async function loadWorkflow(options = {}) {
  showState("Syncing work records...");
  setSyncLine("Syncing");
  elements.refresh.classList.add("is-loading");

  try {
    const response = await fetch(options.forceRefresh ? "/api/workflow?refresh=1" : "/api/workflow");
    const payload = await response.json();
    if (!response.ok) {
      if (payload.authRequired) {
        setDashboardLocked(true);
        showState("Password required.", "error");
        return;
      }
      throw new Error(payload.error || "Unable to sync work records.");
    }
    state.data = payload;
    const time = new Date(payload.updatedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
    const syncLabel =
      payload.cache?.status === "cached"
        ? `Ready ${time}`
        : payload.cache?.status === "stale-refreshing"
          ? `Ready ${time} · updating`
          : `Synced ${time}`;
    showState(payload.syncWarning ? `Showing recent records. Latest sync failed: ${payload.syncWarning}` : syncLabel, payload.syncWarning ? "warning" : "success");
    setSyncLine(syncLabel, payload.syncWarning ? "warning" : "success");
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync work records.";
    showState(`${message} Check the Notion connection, page sharing, or local network availability.`, "error");
    setSyncLine("Sync failed", "error");
  } finally {
    elements.refresh.classList.remove("is-loading");
  }
}

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.activeView = tab.dataset.view;
    render();
  });
});

elements.refresh.addEventListener("click", () => loadWorkflow({ forceRefresh: true }));

elements.authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.authMessage.textContent = "Unlocking...";
  try {
    await login(elements.authPassword.value);
    elements.authMessage.textContent = "";
    setDashboardLocked(false);
    await loadWorkflow();
  } catch (error) {
    elements.authMessage.textContent = error instanceof Error ? error.message : "Unable to unlock dashboard.";
  }
});

async function boot() {
  try {
    const status = await authStatus();
    if (status.authRequired && !status.authenticated) {
      setDashboardLocked(true);
      setSyncLine("Locked");
      elements.authPassword?.focus();
      return;
    }
  } catch {
    // If auth status is unavailable, continue and let workflow loading show the real error.
  }
  setDashboardLocked(false);
  await loadWorkflow();
}

boot();
