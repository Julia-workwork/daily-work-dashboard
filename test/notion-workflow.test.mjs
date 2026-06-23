import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchDailyWorkBlocks,
  fetchNotionTasks,
  notionWorkflowSource,
  parseDailyWorkMarkdown,
  updateDailyWorkTodo,
} from "../lib/notion-workflow.mjs";

const DAILY_MARKDOWN = `
# 2026.06.22-2026.06.27 {toggle="true"}
\t## Monday {toggle="true"}
\t\t- [x] 跟进用户问题3个
\t\t- [ ] Message function 白底图拍摄待完成
# 2026.06.15-2026.06.18 {toggle="true"}
\t## Monday {toggle="true"}
\t\t- [x] blog upload 5 posts
\t\t- [ ] Message 预告帖子 YouTube
\t## Thursday {toggle="true"}
\t\t- [x] Amazon 活动视频修改，Julia自行修改
\t\t- [ ] 品牌数据指标刷新，待刷新 1. 补充互动率 2. 自然增粉
# 2026.05.25-2026.05.30 {toggle="true"}
\t## Monday {toggle="true"}
\t\t- [x] May task should not appear
`;

test("parseDailyWorkMarkdown keeps only the selected month and preserves week ranges", () => {
  const result = parseDailyWorkMarkdown(DAILY_MARKDOWN, { month: "2026-06" });

  assert.deepEqual(result.dailyExtracts.map((item) => item.date), ["2026-06-22", "2026-06-18", "2026-06-15"]);
  assert.deepEqual([...new Set(result.dailyExtracts.map((item) => item.weekRange))], [
    "2026.06.22-2026.06.27",
    "2026.06.15-2026.06.18",
  ]);
  const previousMonday = result.dailyExtracts.find((item) => item.date === "2026-06-15");
  assert.equal(previousMonday.completedWork, "blog upload 5 posts");
  assert.equal(previousMonday.followUps, "Message 预告帖子 YouTube");
  assert.equal(result.tasks.some((task) => task.taskName.includes("May task")), false);
});

test("parseDailyWorkMarkdown turns open todos into read-only workflow tasks", () => {
  const result = parseDailyWorkMarkdown(DAILY_MARKDOWN, { month: "2026-06" });

  const task = result.tasks.find((task) => task.taskName === "品牌数据指标刷新，待刷新 1. 补充互动率 2. 自然增粉");

  assert.equal(task.status, "Not Started");
  assert.equal(task.priority, "P2");
  assert.equal(task.category, "Data");
  assert.equal(task.dueDate, "2026-06-18");
  assert.equal(task.sourceDate, "2026-06-18");
  assert.equal(task.notionLink, "Daily Work");
});

test("parseDailyWorkMarkdown builds a leadership weekly report from concrete content", () => {
  const result = parseDailyWorkMarkdown(DAILY_MARKDOWN, { month: "2026-06" });

  assert.equal(result.weeklyReview.weekRange, "2026.06.22-2026.06.27");
  assert.match(result.weeklyReview.draftWeeklyReport, /跟进用户问题3个/);
  assert.match(result.weeklyReview.draftWeeklyReport, /Message function 白底图拍摄待完成/);
  assert.match(result.weeklyReview.keyOutcomes, /跟进用户问题3个/);
  assert.match(result.weeklyReview.continuedFollowUps, /Message function 白底图拍摄待完成/);
});

test("fetchNotionTasks maps Notion data source pages into dashboard tasks", async () => {
  const requests = [];
  const tasks = await fetchNotionTasks(
    {
      token: "secret",
      dataSourceId: "collection://abc123",
    },
    {
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                id: "task-page-id",
                url: "https://notion.so/task",
                properties: {
                  "Task Name": { title: [{ plain_text: "Follow up John" }] },
                  Status: { status: { name: "In progress" } },
                  Priority: { select: { name: "P1" } },
                  Category: { select: { name: "User Feedback" } },
                  "Due Date": { date: { start: "2026-06-22" } },
                  "Next Action": { rich_text: [{ plain_text: "Ask for test video" }] },
                  Review: { checkbox: true },
                },
              },
            ],
          }),
        };
      },
    },
  );

  assert.equal(requests[0].url, "https://api.notion.com/v1/data_sources/abc123/query");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(tasks[0].taskName, "Follow up John");
  assert.equal(tasks[0].sourceId, "task-page-id");
  assert.equal(tasks[0].sourceType, "workflow-task");
  assert.equal(tasks[0].status, "In Progress");
  assert.equal(tasks[0].needsReview, true);
  assert.equal(tasks[0].notionLink, "https://notion.so/task");
});

test("fetchDailyWorkBlocks maps Notion todo blocks into editable daily source tasks", async () => {
  const source = await fetchDailyWorkBlocks(
    {
      token: "secret",
      pageId: "daily-page",
      today: "2026-06-22",
    },
    {
      fetchImpl: async (url) => {
        if (url === "https://api.notion.com/v1/blocks/daily-page/children?page_size=100") {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  id: "week-block",
                  type: "heading_1",
                  has_children: true,
                  heading_1: { rich_text: [{ plain_text: "2026.06.22-2026.06.27" }] },
                },
              ],
            }),
          };
        }
        if (url === "https://api.notion.com/v1/blocks/week-block/children?page_size=100") {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  id: "day-block",
                  type: "heading_2",
                  has_children: true,
                  heading_2: { rich_text: [{ plain_text: "Monday" }] },
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                id: "todo-block",
                type: "to_do",
                has_children: false,
                to_do: { checked: false, rich_text: [{ plain_text: "[PL][TBD] Message 白底图拍摄" }] },
              },
            ],
          }),
        };
      },
    },
  );

  assert.equal(source.tasks[1][0], "[PL][TBD] Message 白底图拍摄");
  assert.equal(source.tasks[1][10], "todo-block");
  assert.equal(source.tasks[1][11], "daily-work");
});

test("updateDailyWorkTodo patches the source Notion todo block", async () => {
  const calls = [];
  const result = await updateDailyWorkTodo(
    {
      token: "secret",
      blockId: "todo-block",
      task: {
        taskName: "[PL] Message 白底图拍摄完成",
        status: "Done",
      },
    },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: true,
          json: async () => ({ id: "todo-block" }),
        };
      },
    },
  );

  assert.equal(result.id, "todo-block");
  assert.equal(calls[0].url, "https://api.notion.com/v1/blocks/todo-block");
  assert.equal(calls[0].options.method, "PATCH");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.to_do.checked, true);
  assert.equal(body.to_do.rich_text[0].text.content, "[PL] Message 白底图拍摄完成");
});

test("notionWorkflowSource reads Daily Work markdown and Workflow Tasks from Notion", async () => {
  const requests = [];
  const source = await notionWorkflowSource(
    {
      token: "secret",
      dailyWorkPageId: "daily-page",
      tasksDataSourceId: "tasks-source",
      today: "2026-06-22",
    },
    {
      fetchImpl: async (url) => {
        requests.push(url);
        if (url === "https://api.notion.com/v1/pages/daily-page/markdown") {
          return {
            ok: true,
            json: async () => ({ markdown: DAILY_MARKDOWN }),
          };
        }
        return {
          ok: true,
          json: async () => ({ results: [] }),
        };
      },
    },
  );

  assert.equal(source.source.kind, "notion");
  assert.equal(source.dailyExtracts[0][0], "Date");
  assert.equal(source.dailyExtracts[1][0], "2026-06-22");
  assert.equal(source.weeklyReview.at(-1)[0], "2026.06.22-2026.06.27");
  assert.deepEqual(requests, [
    "https://api.notion.com/v1/blocks/daily-page/children?page_size=100",
    "https://api.notion.com/v1/pages/daily-page/markdown",
    "https://api.notion.com/v1/data_sources/tasks-source/query",
  ]);
});
