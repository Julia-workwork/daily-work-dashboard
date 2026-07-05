import test from "node:test";
import assert from "node:assert/strict";
import { buildNotionTaskPayload, createNotionTask, updateNotionTask } from "../lib/notion-tasks.mjs";

test("buildNotionTaskPayload maps dashboard task fields to Workflow Tasks properties", () => {
  const payload = buildNotionTaskPayload({
    taskName: "剪辑 H1 Call Log 视频",
    status: "In Progress",
    priority: "P1",
    category: "Content",
    dueDate: "2026-06-22",
    nextAction: "检查字幕并发布 YouTube",
    workLog: "完成粗剪 1 条",
    needsReview: true,
  });

  assert.deepEqual(payload.properties, {
    "Task Name": { title: [{ text: { content: "剪辑 H1 Call Log 视频" } }] },
    Status: { status: { name: "In progress" } },
    Priority: { select: { name: "P1" } },
    Category: { select: { name: "Content" } },
    "Due Date": { date: { start: "2026-06-22" } },
    "Next Action": { rich_text: [{ text: { content: "检查字幕并发布 YouTube" } }] },
    "Work Log": { rich_text: [{ text: { content: "完成粗剪 1 条" } }] },
    "Needs Review": { checkbox: true },
  });
});

test("buildNotionTaskPayload normalizes slash date values before sending to Notion", () => {
  const payload = buildNotionTaskPayload({
    taskName: "Follow up Message beta user",
    status: "Not Started",
    priority: "P2",
    category: "User Feedback",
    dueDate: "2026/07/01",
  });

  assert.equal(payload.properties["Due Date"].date.start, "2026-07-01");
});

test("createNotionTask posts a new page to the configured Notion data source", async () => {
  const calls = [];
  const result = await createNotionTask(
    {
      token: "secret-token",
      dataSourceId: "collection://abc123",
      task: {
        taskName: "整理 IMC 用户标签反馈",
        status: "Not Started",
        priority: "P2",
        category: "User Feedback",
        nextAction: "同步给研发",
        needsReview: false,
      },
    },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "page-id",
            url: "https://notion.so/task-row",
          }),
        };
      },
    },
  );

  assert.equal(result.url, "https://notion.so/task-row");
  assert.equal(calls[0].url, "https://api.notion.com/v1/pages");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret-token");
  assert.equal(calls[0].options.headers["Notion-Version"], "2026-03-11");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.parent.data_source_id, "abc123");
  assert.equal(body.properties["Task Name"].title[0].text.content, "整理 IMC 用户标签反馈");
  assert.equal(body.properties.Status.status.name, "Not started");
  assert.equal(body.properties["Needs Review"].checkbox, false);
});

test("createNotionTask retries without Needs Review when the data source does not have that property", async () => {
  const calls = [];
  const result = await createNotionTask(
    {
      token: "secret-token",
      dataSourceId: "collection://abc123",
      task: {
        taskName: "Follow up user issue",
        status: "Not Started",
        priority: "P2",
        category: "User Feedback",
        needsReview: true,
      },
    },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        if (calls.length === 1) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ message: "Needs Review is not a property that exists." }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "page-id", url: "https://notion.so/task-row" }),
        };
      },
    },
  );

  assert.equal(result.id, "page-id");
  assert.equal(calls.length, 2);
  assert.ok(JSON.parse(calls[0].options.body).properties["Needs Review"]);
  assert.equal(JSON.parse(calls[1].options.body).properties["Needs Review"], undefined);
});

test("updateNotionTask retries without Needs Review when the page data source does not have that property", async () => {
  const calls = [];
  const result = await updateNotionTask(
    {
      token: "secret-token",
      pageId: "task-page-id",
      task: {
        taskName: "Follow up user issue",
        status: "Done",
        priority: "P2",
        category: "User Feedback",
        needsReview: true,
      },
    },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        if (calls.length === 1) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ message: "Needs Review is not a property that exists." }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "task-page-id", url: "https://notion.so/task-row" }),
        };
      },
    },
  );

  assert.equal(result.id, "task-page-id");
  assert.equal(calls.length, 2);
  assert.ok(JSON.parse(calls[0].options.body).properties["Needs Review"]);
  assert.equal(JSON.parse(calls[1].options.body).properties["Needs Review"], undefined);
});
