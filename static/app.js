const state = {
  data: null,
  activeView: "overview",
  localTasks: [],
  filters: {
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

const DEFAULT_TASK_CATEGORIES = ["Content", "User Feedback", "Product", "Social", "Data", "Operations", "Meeting", "Other"];

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

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "en"));
}

function allTasks(data) {
  return [...state.localTasks, ...data.tasks];
}

function taskFromForm(form) {
  const formData = new FormData(form);
  return {
    taskName: String(formData.get("taskName") || "").trim(),
    nextAction: String(formData.get("nextAction") || "").trim(),
    category: String(formData.get("category") || "").trim() || "Other",
    priority: String(formData.get("priority") || "P2"),
    status: String(formData.get("status") || "Not started"),
    dueDate: String(formData.get("dueDate") || ""),
    sourceDate: todayIso(),
    completedDate: "",
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

function chip(value, kind = "") {
  const className = ["stamp-chip", kind].filter(Boolean).join(" ");
  return `<span class="${className}">${escapeHtml(value || "Blank")}</span>`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function taskStatusChips(task) {
  const chips = [chip(task.priority, priorityClass(task.priority)), chip(task.status, statusClass(task.status))];
  if (task.dueDate) chips.push(chip(task.dueDate, task.dueDate === todayIso() ? "due-today" : "due-date"));
  if (task.needsReview) chips.push(chip("Review", "status-review"));
  return chips.join("");
}

function dateMonth(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : "";
}

function monthTitle(monthKey) {
  if (!monthKey) return "Current Month";
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" });
}

function weekLabel(dateText) {
  if (!dateText) return "Unscheduled Week";
  const date = new Date(`${dateText}T00:00:00`);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (date) => date.toLocaleDateString("en", { month: "short", day: "numeric" });
  return `Week of ${format(monday)} - ${format(sunday)}`;
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

function reportCategories() {
  return [
    { label: "内容与素材", keywords: /视频|拍摄|剪辑|内容|社媒|博客|图文|素材|发布|配文|脚本/i },
    { label: "用户反馈与问题处理", keywords: /用户|反馈|问题|沟通|John|RT\d+|耳机|通信|customer|support/i },
    { label: "跨部门协作", keywords: /IMC|研发|同步|对齐|协作|客服|负责人|确认|review/i },
    { label: "数据与表格整理", keywords: /数据|表格|sheet|标签|分类|归类|整理|分析|复盘/i },
    { label: "文档与流程沉淀", keywords: /文档|周报|说明|流程|草稿|记录|总结|沉淀/i },
    { label: "产品与运营跟进", keywords: /产品|功能|体验|KOC|KOL|社区|运营|活动|测试/i },
  ];
}

function uniqueReportItems(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
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
    .map((item) => ({
      date: item.date,
      week: weekLabel(item.date),
      text: reportSourceText(item),
      type: "daily",
    }));

  const taskItems = data.tasks
    .map((task) => {
      const date = task.sourceDate || task.completedDate || task.dueDate;
      return {
        date,
        week: weekLabel(date),
        text: reportSourceText(task),
        type: "task",
        done: isDone(task),
      };
    })
    .filter((item) => dateMonth(item.date) === monthKey);

  return [...dailyItems, ...taskItems].filter((item) => item.text);
}

function categorySummaryForItems(items) {
  return reportCategories()
    .map((category) => {
      const matches = items.filter((item) => category.keywords.test(item.text));
      const quantity = matches.reduce((total, item) => total + reportQuantity(item.text), 0);
      return {
        ...category,
        quantity,
        examples: uniqueReportItems(matches.flatMap((item) => splitText(item.text))).slice(0, 3),
      };
    })
    .filter((category) => category.quantity || category.examples.length);
}

function leadershipWeekReport(week, items, weekly) {
  const details = uniqueReportItems(items.flatMap((item) => splitText(item.text))).slice(0, 6);
  const categories = categorySummaryForItems(items);
  const openFollowUps = uniqueReportItems([
    ...splitText(weekly.continuedFollowUps),
    ...items.filter((item) => !item.done).flatMap((item) => splitText(item.text)),
  ]).slice(0, 4);

  return {
    week,
    total: items.reduce((total, item) => total + reportQuantity(item.text), 0),
    details,
    categories,
    risks: splitText(weekly.risksIssues).slice(0, 4),
    nextPlan: uniqueReportItems([...splitText(weekly.nextWeekPlan), ...openFollowUps]).slice(0, 4),
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
    .sort((left, right) => left.week.localeCompare(right.week, "en"));

  return {
    monthKey,
    title: monthTitle(monthKey),
    weeks,
    sourceNote: "Source records remain read-only. This page only filters and summarizes the selected month.",
  };
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
  return `
    <article class="focus-row">
      <span class="row-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="focus-copy">
        <h3>${escapeHtml(task.taskName || "Untitled task")}</h3>
        <p>${escapeHtml(task.nextAction || task.category || "Confirm next action")}</p>
      </div>
      <div class="focus-stamps">${taskStatusChips(task)}</div>
    </article>
  `;
}

function renderOverview(data) {
  const openTasks = countBy(data.tasks, (task) => !isDone(task));
  const reviewTasks = countBy(data.tasks, (task) => task.needsReview || String(task.status).includes("Review"));
  const latestDaily = data.dailyExtracts[data.dailyExtracts.length - 1] || {};
  const focusTasks = data.todayFocus.slice(0, 3);

  elements.overview.innerHTML = `
    ${actionHero()}
    <section class="metric-grid">
      ${metricCard("Today's Focus", data.todayFocus.length, "High impact today", "◎")}
      ${metricCard("Open Tasks", openTasks, "In progress", "☷")}
      ${metricCard("Needs Review", reviewTasks, "Check these first", "!", true)}
      ${metricCard("Weekly Draft", data.weeklyReview.weekRange ? 1 : 0, "Ready to refine", "✓")}
    </section>

    <section class="work-grid">
      <article class="zine-panel focus-panel">
        <div class="panel-title-row">
          <h2><span>Today’s Focus</span></h2>
          <button class="text-action" type="button" data-jump-view="tasks">View all tasks</button>
        </div>
        <div class="focus-list">
          ${focusTasks.length ? focusTasks.map(taskRow).join("") : '<p class="empty">No high-impact tasks for now.</p>'}
        </div>
      </article>

      <aside class="side-stack">
        <article class="zine-panel notes-panel">
          <div class="panel-title-row">
            <h2><span>Latest Notes</span></h2>
          </div>
          ${listText(latestDaily.completedWork || latestDaily.followUps || latestDaily.notes)}
        </article>

        <article class="zine-panel draft-panel">
          <div class="panel-title-row">
            <h2><span>Weekly Draft</span></h2>
            <button class="text-action" type="button" data-jump-view="weekly">Open draft</button>
          </div>
          <h3>${escapeHtml(data.weeklyReview.weekRange || "Current week")}</h3>
          <p>${escapeHtml(data.weeklyReview.draftWeeklyReport || "No weekly draft captured yet.")}</p>
          <div class="progress-line" aria-hidden="true"><span></span></div>
        </article>
      </aside>
    </section>
  `;

  bindJumpButtons();
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

function filteredTasks(data) {
  return allTasks(data).filter((task) => {
    return (
      (state.filters.priority === "All" || task.priority === state.filters.priority) &&
      (state.filters.status === "All" || task.status === state.filters.status) &&
      (state.filters.category === "All" || task.category === state.filters.category)
    );
  });
}

function taskTable(tasks) {
  return `
    <div class="table-panel">
      <div class="table-row table-head">
        <span>Task</span><span>Category</span><span>Priority</span><span>Status</span><span>Due</span><span>Next Action</span>
      </div>
      ${
        tasks.length
          ? tasks
              .map(
                (task) => `
                  <div class="table-row">
                    <span>${escapeHtml(task.taskName)}${task.isLocalDraft ? '<em class="local-task-mark">Kept as local draft</em>' : ""}${task.notionUrl ? '<em class="local-task-mark">Saved to Workflow Tasks</em>' : ""}</span>
                    <span>${escapeHtml(task.category)}</span>
                    <span>${chip(task.priority, priorityClass(task.priority))}</span>
                    <span>${chip(task.status, statusClass(task.status))}</span>
                    <span>${escapeHtml(task.dueDate || "—")}</span>
                    <span>${escapeHtml(task.nextAction || "—")}</span>
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
        <p class="task-form-note">Save a new task to the Workflow Tasks Notion database. Daily Work source records remain read-only.</p>
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
            <input name="category" list="category-options" placeholder="Product / Content / Support" />
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
              ${unique([...data.tasks.map((task) => task.status), "Not started", "In progress", "Done"]).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
            </select>
          </label>
        </div>
        <label class="task-form-check">
          <input name="needsReview" type="checkbox" />
          <span>Needs review</span>
        </label>
        <datalist id="category-options">
          ${unique([...DEFAULT_TASK_CATEGORIES, ...data.tasks.map((task) => task.category)]).map((value) => `<option value="${escapeHtml(value)}"></option>`).join("")}
        </datalist>
        <div class="task-form-actions">
          <button class="text-action" type="button" data-close-task>Cancel</button>
          <button class="text-action primary-action" type="submit">Save to Notion</button>
        </div>
        <p class="task-save-status" data-task-save-status></p>
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

function bindTaskCreator(data) {
  const dialog = elements.tasks.querySelector("#task-dialog");
  const form = elements.tasks.querySelector("#task-form");
  const status = elements.tasks.querySelector("[data-task-save-status]");
  elements.tasks.querySelector("[data-open-task]")?.addEventListener("click", () => dialog?.showModal());
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
      state.localTasks.unshift({
        ...task,
        notionUrl: result.notionUrl || "",
      });
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

function renderTasks(data) {
  const tasks = filteredTasks(data);
  const taskPool = allTasks(data);
  elements.tasks.innerHTML = `
    <section class="page-kicker">
      <p class="eyebrow">Task Board</p>
      <h1>Track the follow-up.</h1>
    </section>
    <section class="task-toolbar">
      <div class="filters">
        ${filterSelect("Priority", "priority", unique(taskPool.map((task) => task.priority)))}
        ${filterSelect("Status", "status", unique(taskPool.map((task) => task.status)))}
        ${filterSelect("Category", "category", unique(taskPool.map((task) => task.category)))}
      </div>
      <button class="text-action primary-action" type="button" data-open-task>New Task</button>
    </section>
    <article class="zine-panel">${taskTable(tasks)}</article>
    ${taskForm(data)}
  `;

  elements.tasks.querySelectorAll("select").forEach((select) => {
    if (!select.dataset.filter) return;
    select.addEventListener("change", () => {
      state.filters[select.dataset.filter] = select.value;
      renderTasks(data);
    });
  });
  bindTaskCreator(data);
}

function weeklyBlock(title, value) {
  return `
    <article class="weekly-block">
      <h2><span>${title}</span></h2>
      ${listText(value)}
    </article>
  `;
}

function quantifiedLine(category) {
  const example = category.examples[0] ? `，例如：${category.examples[0]}` : "";
  return `<li><strong>${category.label}</strong>：本周形成 ${category.quantity} 项可汇报产出${escapeHtml(example)}。</li>`;
}

function weeklyLeadershipCard(report, index) {
  const detailItems = report.details.length
    ? report.details.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>本周暂无可汇总记录。</li>";
  const quantItems = report.categories.length
    ? report.categories.map(quantifiedLine).join("")
    : "<li>本周记录较少，建议补充类型、数量和产出说明。</li>";
  const riskItems = report.risks.length
    ? report.risks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>暂无明确风险记录，建议如有待协调事项可在日记中单独标注。</li>";
  const planItems = report.nextPlan.length
    ? report.nextPlan.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>继续整理本周产出，并补充下周计划。</li>";

  return `
    <article class="weekly-report-card">
      <header class="weekly-report-header">
        <div>
          <p>Leadership Weekly Report</p>
          <h2>${escapeHtml(report.week || `Week ${index + 1}`)}</h2>
        </div>
        <strong>${report.total}</strong>
      </header>
      <p class="weekly-report-summary">本周基于日常记录整理出 ${report.total} 项可汇报工作内容，覆盖内容产出、用户问题处理、跨部门协作、数据整理与文档沉淀等方向。</p>
      <div class="weekly-report-sections">
        <section>
          <h3>本周完成</h3>
          <ul>${detailItems}</ul>
        </section>
        <section>
          <h3>量化产出</h3>
          <ul>${quantItems}</ul>
        </section>
        <section>
          <h3>待协调事项</h3>
          <ul>${riskItems}</ul>
        </section>
        <section>
          <h3>下周计划</h3>
          <ul>${planItems}</ul>
        </section>
      </div>
    </article>
  `;
}

function renderWeekly(data) {
  const monthly = monthlyLeadershipReport(data);
  elements.weekly.innerHTML = `
    <section class="page-kicker">
      <p class="eyebrow">Monthly Report</p>
      <h1>${escapeHtml(monthly.title)} work summary.</h1>
    </section>
    <section class="monthly-report-shell">
      <div class="monthly-report-note">${escapeHtml(monthly.sourceNote)}</div>
      ${
        monthly.weeks.length
          ? monthly.weeks.map(weeklyLeadershipCard).join("")
          : '<article class="weekly-report-card"><h2>No records for this month yet.</h2><p class="muted">Add daily notes with type, action, quantity, and output so the report can summarize them.</p></article>'
      }
    </section>
  `;
}

function renderSettings(data) {
  const groups = data.settings || {};
  elements.settings.innerHTML = `
    <section class="page-kicker">
      <p class="eyebrow">Settings</p>
      <h1>System labels.</h1>
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

async function loadWorkflow() {
  showState("Syncing work records...");
  setSyncLine("Syncing");
  elements.refresh.classList.add("is-loading");

  try {
    const response = await fetch("/api/workflow");
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
    showState(`Synced ${time}`, "success");
    setSyncLine(`Synced ${time}`, "success");
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync work records.";
    showState(`${message} Check Google Sheet link access or local network availability.`, "error");
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

elements.refresh.addEventListener("click", loadWorkflow);

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
