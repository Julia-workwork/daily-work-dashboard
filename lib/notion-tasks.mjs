const NOTION_CREATE_PAGE_URL = "https://api.notion.com/v1/pages";
const NOTION_PAGE_URL = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2026-03-11";

function clean(value) {
  return String(value ?? "").trim();
}

function stripCollectionPrefix(value) {
  return clean(value).replace(/^collection:\/\//, "");
}

function richText(value) {
  const text = clean(value);
  return text ? [{ text: { content: text } }] : [];
}

function notionDate(value) {
  const text = clean(value).replaceAll("/", "-");
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return text;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function notionStatus(value) {
  const text = clean(value).toLowerCase();
  if (text === "done") return "Done";
  if (text === "not started" || text === "not started") return "Not started";
  return "In progress";
}

export function buildNotionTaskPayload(task) {
  const properties = {
    "Task Name": { title: [{ text: { content: clean(task.taskName) } }] },
    Status: { status: { name: notionStatus(task.status) } },
    Priority: { select: { name: clean(task.priority) || "P2" } },
    Category: { select: { name: clean(task.category) || "Other" } },
    "Next Action": { rich_text: richText(task.nextAction) },
    "Needs Review": { checkbox: Boolean(task.needsReview) },
  };

  const dueDate = notionDate(task.dueDate);
  if (dueDate) properties["Due Date"] = { date: { start: dueDate } };

  return { properties };
}

function notionErrorMessage(payload, fallback) {
  if (payload && typeof payload === "object" && typeof payload.message === "string") return payload.message;
  return fallback;
}

export async function createNotionTask(options, dependencies = {}) {
  const token = clean(options.token);
  const dataSourceId = stripCollectionPrefix(options.dataSourceId);
  const fetchImpl = dependencies.fetchImpl || fetch;

  if (!token) throw Object.assign(new Error("Notion token is not configured."), { statusCode: 503 });
  if (!dataSourceId) throw Object.assign(new Error("Notion tasks data source is not configured."), { statusCode: 503 });

  const taskPayload = buildNotionTaskPayload(options.task || {});
  const response = await fetchImpl(NOTION_CREATE_PAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { data_source_id: dataSourceId },
      ...taskPayload,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = notionErrorMessage(payload, `Notion request failed with status ${response.status}.`);
    throw Object.assign(new Error(message), { statusCode: response.status || 502 });
  }

  return {
    id: payload.id || "",
    url: payload.url || "",
  };
}

export async function updateNotionTask(options, dependencies = {}) {
  const token = clean(options.token);
  const pageId = clean(options.pageId);
  const fetchImpl = dependencies.fetchImpl || fetch;

  if (!token) throw Object.assign(new Error("Notion token is not configured."), { statusCode: 503 });
  if (!pageId) throw Object.assign(new Error("Notion task page id is required."), { statusCode: 400 });

  const taskPayload = buildNotionTaskPayload(options.task || {});
  const response = await fetchImpl(`${NOTION_PAGE_URL}/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify(taskPayload),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = notionErrorMessage(payload, `Notion request failed with status ${response.status}.`);
    throw Object.assign(new Error(message), { statusCode: response.status || 502 });
  }

  return {
    id: payload.id || pageId,
    url: payload.url || "",
  };
}
