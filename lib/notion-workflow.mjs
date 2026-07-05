const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11";

const DAILY_HEADERS = [
  "Date",
  "Weekday",
  "Week Range",
  "Notion Source",
  "Completed Work",
  "Key Outputs",
  "In Progress",
  "Follow-ups",
  "Risks / Issues",
  "Tomorrow Reminders",
  "Weekly Report Candidate",
  "Notes",
];

const TASK_HEADERS = [
  "Task Name",
  "Category",
  "Priority",
  "Status",
  "Due Date",
  "Source Date",
  "Notion Link",
  "Next Action",
  "Work Log",
  "Needs Review",
  "Completed Date",
  "Source ID",
  "Source Type",
];

const WEEKLY_HEADERS = [
  "Week Range",
  "Key Outcomes",
  "Category Summary",
  "Data / Links",
  "Risks / Issues",
  "Continued Follow-ups",
  "Next Week Plan",
  "Draft Weekly Report",
];

const CATEGORY_HEADERS = ["Category", "Open Tasks", "Done Tasks", "Needs Review", "This Week Items"];
const SETTINGS_ROWS = [
  ["Type", "Value", "Color", "Description", "Active"],
  ["Category", "Content", "", "Content creation and publishing", "TRUE"],
  ["Category", "User Feedback", "", "User issues and follow-ups", "TRUE"],
  ["Category", "Product", "", "Product work and requirements", "TRUE"],
  ["Category", "Social", "", "Social media operations", "TRUE"],
  ["Category", "Data", "", "Data analysis and reporting", "TRUE"],
  ["Category", "Operations", "", "Operations and coordination", "TRUE"],
  ["Category", "Meeting", "", "Meetings and alignment", "TRUE"],
  ["Category", "Other", "", "Unclassified work", "TRUE"],
  ["Priority", "P1", "", "High impact", "TRUE"],
  ["Priority", "P2", "", "Normal priority", "TRUE"],
  ["Priority", "P3", "", "Low priority", "TRUE"],
  ["Status", "Not Started", "", "Not started", "TRUE"],
  ["Status", "In Progress", "", "In progress", "TRUE"],
  ["Status", "Waiting on Others", "", "Waiting on others", "TRUE"],
  ["Status", "Done", "", "Done", "TRUE"],
];

const WEEKDAY_OFFSETS = new Map([
  ["monday", 0],
  ["tuesday", 1],
  ["wednesday", 2],
  ["wedenesday", 2],
  ["wendesday", 2],
  ["thursday", 3],
  ["friday", 4],
  ["saturday", 5],
  ["sunday", 6],
]);

function clean(value) {
  return String(value ?? "").trim();
}

function stripCollectionPrefix(value) {
  return clean(value).replace(/^collection:\/\//, "");
}

function plainText(items = []) {
  return items.map((item) => clean(item.plain_text || item.text?.content)).join("").trim();
}

function blockText(block) {
  const value = block?.[block.type]?.rich_text || block?.[block.type]?.title || [];
  return plainText(value);
}

function normalizeStatus(value) {
  const text = clean(value).toLowerCase();
  if (text === "done") return "Done";
  if (text === "not started") return "Not Started";
  if (text === "waiting on others") return "Waiting on Others";
  return "In Progress";
}

function isoFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseWeekRange(text) {
  const match = clean(text).match(/^#\s*(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*-\s*(?:(\d{4})[./-])?(\d{1,2})[./-](\d{1,2})/);
  if (!match) return null;
  const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = match;
  return {
    label: `${startYear}.${String(startMonth).padStart(2, "0")}.${String(startDay).padStart(2, "0")}-${endYear ? `${endYear}.` : ""}${String(endMonth).padStart(2, "0")}.${String(endDay).padStart(2, "0")}`,
    startDate: isoFromParts(startYear, startMonth, startDay),
    endDate: isoFromParts(endYear || startYear, endMonth, endDay),
    monthKey: `${startYear}-${String(startMonth).padStart(2, "0")}`,
  };
}

function parseDayName(text) {
  const match = clean(text).match(/^##\s*([A-Za-z]+)/);
  if (!match) return "";
  return match[1];
}

function isWeekdayName(text) {
  return WEEKDAY_OFFSETS.has(clean(text).toLowerCase());
}

function isOngoingHeading(text) {
  return /ongoing|持续|本周推进|本周持续|this week/i.test(clean(text));
}

function dateForDay(week, dayName) {
  const offset = WEEKDAY_OFFSETS.get(clean(dayName).toLowerCase());
  if (offset === undefined || !week?.startDate) return "";
  const date = new Date(`${week.startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function parseTodo(line) {
  const match = clean(line).match(/^- \[(x| )\]\s*(.*)$/i);
  if (!match) return null;
  const text = clean(match[2]).replace(/<br>/g, " ").replace(/\s+/g, " ");
  if (!text) return null;
  return { done: match[1].toLowerCase() === "x", text };
}

function todoFromBlock(block) {
  if (block?.type !== "to_do") return null;
  const text = blockText(block).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return {
    id: clean(block.id),
    done: Boolean(block.to_do?.checked),
    text,
  };
}

function extractDueDate(text) {
  const iso = text.match(/(?:due[:：]?\s*)?(\d{4})[./-](\d{1,2})[./-](\d{1,2})/i);
  if (iso) return isoFromParts(iso[1], iso[2], iso[3]);

  const monthName = text.match(/due[:：]?\s*(Jan|Feb|Mar|Apr|May|Jun|June|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})/i);
  if (!monthName) return "";
  const monthMap = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const key = monthName[1].toLowerCase();
  return `2026-${monthMap[key]}-${monthName[2].padStart(2, "0")}`;
}

function inferCategory(text) {
  if (/视频|拍摄|剪辑|脚本|blog|博客|post|发布|YouTube|TikTok|内容|图片|素材/i.test(text)) return "Content";
  if (/用户|客户|John|RT\d+|RV\d+|LR\d+|售后|问题|feedback|customer/i.test(text)) return "User Feedback";
  if (/数据|指标|表格|标签|分析|洞察|ppt/i.test(text)) return "Data";
  if (/IMC|会议|meeting|对接|沟通|同步|负责人/i.test(text)) return "Meeting";
  if (/社媒|群组|community|group|活动/i.test(text)) return "Social";
  if (/功能|firmware|固件|APRS|Message|HA2|H1|产品/i.test(text)) return "Product";
  return "Other";
}

function inferPriority(text) {
  if (/\bP1\b|重要|必须|urgent|first/i.test(text)) return "P1";
  if (/\bP3\b|低优先级/i.test(text)) return "P3";
  return "P2";
}

function joinItems(items) {
  return items.map((item) => item.text).join("；");
}

function markdownLines(markdown) {
  return String(markdown || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s+/, "").trim())
    .filter(Boolean);
}

function summarizeWeek(week) {
  const completed = week.days.flatMap((day) => day.completed.map((item) => item.text));
  const open = week.days.flatMap((day) => day.open.map((item) => item.text));
  const ongoingCompleted = (week.ongoing || []).filter((item) => item.done).map((item) => item.text);
  const ongoingOpen = (week.ongoing || []).filter((item) => !item.done).map((item) => item.text);
  const categoryCounts = new Map();
  for (const item of [...completed, ...open, ...ongoingCompleted, ...ongoingOpen]) {
    const category = inferCategory(item);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  const categorySummary = [...categoryCounts.entries()]
    .map(([category, count]) => `${category}: ${count}`)
    .join("；");
  const outcome = [...ongoingCompleted, ...completed].slice(0, 8).join("；");
  const followUps = [...ongoingOpen, ...open].slice(0, 8).join("；");

  return {
    weekRange: week.label,
    keyOutcomes: outcome,
    categorySummary,
    dataLinks: "Notion Daily Work",
    risksIssues: "",
    continuedFollowUps: followUps,
    nextWeekPlan: followUps,
    draftWeeklyReport: [
      outcome ? `Completed: ${outcome}` : "",
      followUps ? `Follow-up: ${followUps}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function categoryRows(tasks) {
  const grouped = new Map();
  for (const task of tasks) {
    const current = grouped.get(task.category) || { open: 0, done: 0, review: 0, total: 0 };
    current.total += 1;
    if (task.status === "Done") current.done += 1;
    else current.open += 1;
    if (task.needsReview) current.review += 1;
    grouped.set(task.category, current);
  }
  return [
    CATEGORY_HEADERS,
    ...[...grouped.entries()].map(([category, counts]) => [
      category,
      String(counts.open),
      String(counts.done),
      String(counts.review),
      String(counts.total),
    ]),
  ];
}

function rowsFromParsed(parsed, notionTasks) {
  const dailyRows = [
    DAILY_HEADERS,
    ...parsed.dailyExtracts.map((item) => [
      item.date,
      item.weekday,
      item.weekRange,
      item.notionSource,
      item.completedWork,
      item.keyOutputs,
      item.inProgress,
      item.followUps,
      item.risksIssues,
      item.tomorrowReminders,
      item.weeklyReportCandidate,
      item.notes,
    ]),
  ];
  const tasks = [...parsed.tasks, ...notionTasks];
  const taskRows = [
    TASK_HEADERS,
    ...tasks.map((task) => [
      task.taskName,
      task.category,
      task.priority,
      task.status,
      task.dueDate,
      task.sourceDate,
      task.notionLink,
      task.nextAction,
      task.workLog,
      task.needsReview ? "TRUE" : "FALSE",
      task.completedDate,
      task.sourceId,
      task.sourceType,
    ]),
  ];
  const weeklyRows = [
    WEEKLY_HEADERS,
    ...parsed.weeklyReviews.map((item) => [
      item.weekRange,
      item.keyOutcomes,
      item.categorySummary,
      item.dataLinks,
      item.risksIssues,
      item.continuedFollowUps,
      item.nextWeekPlan,
      item.draftWeeklyReport,
    ]),
  ];
  return {
    dailyExtracts: dailyRows,
    tasks: taskRows,
    weeklyReview: weeklyRows,
    categorySummary: categoryRows(tasks),
    settings: SETTINGS_ROWS,
    source: parsed.source,
  };
}

export function parseDailyWorkMarkdown(markdown, options = {}) {
  const month = options.month || clean(options.today).slice(0, 7) || new Date().toISOString().slice(0, 7);
  const weeks = [];
  let currentWeek = null;
  let currentDay = null;
  let inOngoing = false;

  for (const line of markdownLines(markdown)) {
    const week = parseWeekRange(line);
    if (week) {
      currentWeek = { ...week, days: [], ongoing: [] };
      weeks.push(currentWeek);
      currentDay = null;
      inOngoing = false;
      continue;
    }

    const headingText = clean(line).replace(/^#+\s*/, "").replace(/\s*\{.*$/, "");
    if (currentWeek && isOngoingHeading(headingText)) {
      currentDay = null;
      inOngoing = true;
      continue;
    }

    const dayName = parseDayName(line);
    if (dayName && currentWeek && isWeekdayName(dayName)) {
      currentDay = {
        weekday: dayName,
        date: dateForDay(currentWeek, dayName),
        completed: [],
        open: [],
      };
      currentWeek.days.push(currentDay);
      inOngoing = false;
      continue;
    }

    const todo = parseTodo(line);
    if (todo && currentWeek && inOngoing) {
      currentWeek.ongoing.push(todo);
      continue;
    }
    if (todo && currentWeek && currentDay) {
      if (todo.done) currentDay.completed.push(todo);
      else currentDay.open.push(todo);
    }
  }

  const selectedWeeks = weeks.filter(
    (week) =>
      week.days.some((day) => day.date.startsWith(month)) ||
      (week.ongoing?.length && week.startDate <= `${month}-31` && week.endDate >= `${month}-01`),
  );
  const dailyExtracts = [];
  const tasks = [];
  const weeklyReviews = [];

  for (const week of selectedWeeks) {
    if (week.ongoing?.length) {
      const completed = week.ongoing.filter((item) => item.done);
      const open = week.ongoing.filter((item) => !item.done);
      dailyExtracts.push({
        date: week.startDate,
        weekday: "This Week Ongoing",
        weekRange: week.label,
        notionSource: "Daily Work",
        completedWork: joinItems(completed),
        keyOutputs: joinItems(completed),
        inProgress: joinItems(open),
        followUps: joinItems(open),
        risksIssues: "",
        tomorrowReminders: "",
        weeklyReportCandidate: joinItems([...completed, ...open]),
        notes: "Weekly-level ongoing work",
      });
      for (const item of open) {
        tasks.push({
          taskName: item.text,
          category: inferCategory(item.text),
          priority: inferPriority(item.text),
          status: "Not Started",
          dueDate: extractDueDate(item.text) || week.endDate,
          sourceDate: week.startDate,
          notionLink: "Daily Work",
          nextAction: item.text,
          needsReview: /review|check|确认|待确认|复盘/i.test(item.text),
          completedDate: "",
          sourceId: item.id || "",
          sourceType: item.id ? "daily-work" : "",
        });
      }
    }

    for (const day of week.days) {
      if (!day.date.startsWith(month)) continue;
      dailyExtracts.push({
        date: day.date,
        weekday: day.weekday,
        weekRange: week.label,
        notionSource: "Daily Work",
        completedWork: joinItems(day.completed),
        keyOutputs: joinItems(day.completed),
        inProgress: "",
        followUps: joinItems(day.open),
        risksIssues: "",
        tomorrowReminders: "",
        weeklyReportCandidate: joinItems([...day.completed, ...day.open]),
        notes: "",
      });

      for (const item of day.open) {
        tasks.push({
          taskName: item.text,
          category: inferCategory(item.text),
          priority: inferPriority(item.text),
          status: "Not Started",
          dueDate: extractDueDate(item.text) || day.date,
          sourceDate: day.date,
          notionLink: "Daily Work",
          nextAction: item.text,
          needsReview: /review|check|确认|待确认|复盘/i.test(item.text),
          completedDate: "",
          sourceId: item.id || "",
          sourceType: item.id ? "daily-work" : "",
        });
      }
    }
    weeklyReviews.push(summarizeWeek(week));
  }

  dailyExtracts.sort((left, right) => right.date.localeCompare(left.date));
  tasks.sort((left, right) => right.sourceDate.localeCompare(left.sourceDate));
  weeklyReviews.sort((left, right) => left.weekRange.localeCompare(right.weekRange));

  return {
    dailyExtracts,
    tasks,
    weeklyReview: weeklyReviews.at(-1) || {},
    weeklyReviews,
    source: {
      kind: "notion",
      month,
      dailyWorkPageId: clean(options.dailyWorkPageId),
    },
  };
}

export function parseDailyWorkBlocks(blocks, options = {}) {
  const month = options.month || clean(options.today).slice(0, 7) || new Date().toISOString().slice(0, 7);
  const weeks = [];

  for (const weekBlock of blocks || []) {
    const week = parseWeekRange(`# ${blockText(weekBlock)}`);
    if (!week) continue;
    const currentWeek = { ...week, days: [], ongoing: [] };
    weeks.push(currentWeek);
    let currentOngoing = false;

    for (const dayBlock of weekBlock.children || []) {
      const headingText = dayBlock.type?.startsWith("heading") ? blockText(dayBlock) : "";
      if (isOngoingHeading(headingText)) {
        currentOngoing = true;
        for (const child of dayBlock.children || []) {
          const todo = todoFromBlock(child);
          if (todo) currentWeek.ongoing.push(todo);
        }
        continue;
      }
      const dayName = isWeekdayName(headingText) ? headingText : "";
      if (!dayName) {
        if (currentOngoing) {
          const todo = todoFromBlock(dayBlock);
          if (todo) currentWeek.ongoing.push(todo);
        }
        continue;
      }
      currentOngoing = false;
      const currentDay = {
        weekday: dayName,
        date: dateForDay(currentWeek, dayName),
        completed: [],
        open: [],
      };
      currentWeek.days.push(currentDay);

      for (const child of dayBlock.children || []) {
        const todo = todoFromBlock(child);
        if (!todo) continue;
        if (todo.done) currentDay.completed.push(todo);
        else currentDay.open.push(todo);
      }
    }
  }

  const parsed = parseDailyWorkMarkdown(
    weeks
      .map((week) =>
        [
          `# ${week.label}`,
          ...(week.ongoing?.length
            ? [
                "## This Week Ongoing",
                ...week.ongoing.map((item) => `- [${item.done ? "x" : " "}] ${item.text}`),
              ]
            : []),
          ...week.days.flatMap((day) => [
            `## ${day.weekday}`,
            ...day.completed.map((item) => `- [x] ${item.text}`),
            ...day.open.map((item) => `- [ ] ${item.text}`),
          ]),
        ].join("\n"),
      )
      .join("\n"),
    {
      ...options,
      month,
      dailyWorkPageId: options.dailyWorkPageId,
    },
  );

  const sourceIds = new Map();
  for (const week of weeks) {
    for (const item of week.ongoing || []) {
      if (item.id) sourceIds.set(item.text, item.id);
    }
    for (const day of week.days) {
      for (const item of day.open) {
        if (item.id) sourceIds.set(item.text, item.id);
      }
    }
  }
  parsed.tasks = parsed.tasks.map((task) => ({
    ...task,
    sourceId: sourceIds.get(task.taskName) || task.sourceId || "",
    sourceType: sourceIds.has(task.taskName) ? "daily-work" : task.sourceType || "",
  }));
  return parsed;
}

function notionHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

async function notionJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && typeof payload.message === "string" ? payload.message : fallback;
    throw Object.assign(new Error(message), { statusCode: response.status || 502 });
  }
  return payload;
}

export async function fetchDailyWorkMarkdown(options, dependencies = {}) {
  const token = clean(options.token);
  const pageId = clean(options.pageId);
  const fetchImpl = dependencies.fetchImpl || fetch;
  if (!token) throw Object.assign(new Error("Notion token is not configured."), { statusCode: 503 });
  if (!pageId) throw Object.assign(new Error("Notion Daily Work page is not configured."), { statusCode: 503 });

  const response = await fetchImpl(`${NOTION_API_BASE}/pages/${pageId}/markdown`, {
    method: "GET",
    headers: notionHeaders(token),
  });
  const payload = await notionJson(response, `Notion Daily Work request failed with status ${response.status}.`);
  return clean(payload.markdown);
}

async function fetchBlockChildren(blockId, token, fetchImpl) {
  const children = [];
  let startCursor = "";
  do {
    const response = await fetchImpl(
      `${NOTION_API_BASE}/blocks/${blockId}/children?page_size=100${startCursor ? `&start_cursor=${startCursor}` : ""}`,
      {
        method: "GET",
        headers: notionHeaders(token),
      },
    );
    const payload = await notionJson(response, `Notion block request failed with status ${response.status}.`);
    for (const block of payload.results || []) {
      const next = { ...block };
      if (next.has_children) {
        next.children = await fetchBlockChildren(next.id, token, fetchImpl);
      }
      children.push(next);
    }
    startCursor = payload.has_more ? payload.next_cursor : "";
  } while (startCursor);
  return children;
}

export async function fetchDailyWorkBlocks(options, dependencies = {}) {
  const token = clean(options.token);
  const pageId = clean(options.pageId);
  const fetchImpl = dependencies.fetchImpl || fetch;
  if (!token) throw Object.assign(new Error("Notion token is not configured."), { statusCode: 503 });
  if (!pageId) throw Object.assign(new Error("Notion Daily Work page is not configured."), { statusCode: 503 });

  const blocks = await fetchBlockChildren(pageId, token, fetchImpl);
  const parsed = parseDailyWorkBlocks(blocks, {
    month: options.month || clean(options.today).slice(0, 7),
    today: options.today,
    dailyWorkPageId: pageId,
  });
  const notionTasks = await fetchNotionTasks(
    {
      token,
      dataSourceId: options.tasksDataSourceId,
    },
    dependencies,
  );
  return rowsFromParsed(parsed, notionTasks);
}

export async function updateDailyWorkTodo(options, dependencies = {}) {
  const token = clean(options.token);
  const blockId = clean(options.blockId);
  const task = options.task || {};
  const fetchImpl = dependencies.fetchImpl || fetch;
  if (!token) throw Object.assign(new Error("Notion token is not configured."), { statusCode: 503 });
  if (!blockId) throw Object.assign(new Error("Notion Daily Work block id is required."), { statusCode: 400 });

  const text = clean(task.taskName || task.nextAction);
  if (!text) throw Object.assign(new Error("Task name is required."), { statusCode: 400 });

  const response = await fetchImpl(`${NOTION_API_BASE}/blocks/${blockId}`, {
    method: "PATCH",
    headers: notionHeaders(token),
    body: JSON.stringify({
      to_do: {
        rich_text: [{ text: { content: text } }],
        checked: normalizeStatus(task.status) === "Done",
      },
    }),
  });
  const payload = await notionJson(response, `Notion Daily Work update failed with status ${response.status}.`);
  return {
    id: payload.id || blockId,
  };
}

function propertyTitle(property) {
  return plainText(property?.title || property?.rich_text || []);
}

function pageToTask(page) {
  const properties = page.properties || {};
  const recordTime = clean(properties["Created Time"]?.created_time || properties.Created?.created_time || page.created_time);
  return {
    taskName: propertyTitle(properties["Task Name"]),
    category: clean(properties.Category?.select?.name) || "Other",
    priority: clean(properties.Priority?.select?.name) || "P2",
    status: normalizeStatus(properties.Status?.status?.name),
    dueDate: clean(properties["Due Date"]?.date?.start),
    sourceDate: clean(properties["Due Date"]?.date?.start),
    recordTime,
    notionLink: clean(page.url),
    nextAction: plainText(properties["Next Action"]?.rich_text || []),
    workLog: plainText(properties["Work Log"]?.rich_text || []),
    needsReview: Boolean(properties.Review?.checkbox || properties["Needs Review"]?.checkbox),
    completedDate: "",
    sourceId: clean(page.id),
    sourceType: "workflow-task",
  };
}

export async function fetchNotionTasks(options, dependencies = {}) {
  const token = clean(options.token);
  const dataSourceId = stripCollectionPrefix(options.dataSourceId);
  const fetchImpl = dependencies.fetchImpl || fetch;
  if (!token) throw Object.assign(new Error("Notion token is not configured."), { statusCode: 503 });
  if (!dataSourceId) return [];

  const tasks = [];
  let startCursor = "";
  do {
    const response = await fetchImpl(`${NOTION_API_BASE}/data_sources/${dataSourceId}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        page_size: 100,
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    });
    const payload = await notionJson(response, `Notion tasks request failed with status ${response.status}.`);
    tasks.push(...(payload.results || []).map(pageToTask).filter((task) => task.taskName));
    startCursor = payload.has_more ? payload.next_cursor : "";
  } while (startCursor);

  return tasks;
}

export async function notionWorkflowSource(options, dependencies = {}) {
  const token = clean(options.token);
  const today = clean(options.today) || new Date().toISOString().slice(0, 10);
  const month = clean(options.month) || today.slice(0, 7);
  let parsed;
  try {
    const blocks = await fetchBlockChildren(options.dailyWorkPageId, token, dependencies.fetchImpl || fetch);
    parsed = parseDailyWorkBlocks(blocks, {
      month,
      today,
      dailyWorkPageId: options.dailyWorkPageId,
    });
  } catch {
    parsed = null;
  }

  if (!parsed || (!parsed.dailyExtracts.length && !parsed.tasks.length)) {
    const markdown = await fetchDailyWorkMarkdown(
      {
        token,
        pageId: options.dailyWorkPageId,
      },
      dependencies,
    );
    parsed = parseDailyWorkMarkdown(markdown, {
      month,
      today,
      dailyWorkPageId: options.dailyWorkPageId,
    });
  }

  const notionTasks = await fetchNotionTasks(
    {
      token,
      dataSourceId: options.tasksDataSourceId,
    },
    dependencies,
  );

  return rowsFromParsed(parsed, notionTasks);
}
