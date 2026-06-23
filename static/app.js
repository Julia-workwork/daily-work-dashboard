const state = {
  data: null,
  activeView: "overview",
  localTasks: [],
  selectedWeek: "",
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

function uniqueReportItems(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function reportTags(text) {
  return [...String(text).matchAll(/\\?\[([^\]\\]+)\\?\]/g)].map((match) => match[1].trim().toLowerCase());
}

function hasReportTag(item, tags) {
  const itemTags = reportTags(item.text);
  return tags.some((tag) => itemTags.includes(tag.toLowerCase()));
}

function displayReportText(text) {
  return String(text || "")
    .replace(/\\?\[[^\]\\]+\\?\]\s*/g, "")
    .replace(/^\\+/, "")
    .trim();
}

function itemMatches(item, tags, keywords) {
  return hasReportTag(item, tags) || keywords.test(item.text);
}

function reportSection(title, items) {
  const uniqueItems = uniqueReportItems(items.map((item) => displayReportText(item.text))).slice(0, 6);
  const total = items.reduce((sum, item) => sum + reportQuantity(item.text), 0);
  return { title, total, items: uniqueItems };
}

function workflowSections(items) {
  const productLine = items.filter((item) =>
    itemMatches(item, ["Product Line"], /产品|功能|固件|firmware|beta|APRS|Message|HA2|H1|需求|研发|PM|测试|User Issue|用户|问题|RV\d+|RT\d+|LR\d+/i),
  );
  const brand = items.filter((item) =>
    itemMatches(item, ["Brand"], /品牌|社媒|social|post|YouTube|TikTok|blog|博客|图片|素材|活动|展会|KOC|KOL|美工|数据指标|粉丝/i),
  );
  const imc = items.filter((item) =>
    itemMatches(item, ["IMC"], /IMC|汇报|用户标签|标签|洞察|PPT|排期|对齐|传播|文件更新/i),
  );
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
    .flatMap((item) => {
      const completed = splitText([item.completedWork, item.keyOutputs, item.weeklyReportCandidate].filter(Boolean).join("；")).map((text) => ({
        date: item.date,
        week: weekLabel(item.date),
        text,
        type: "daily",
        done: true,
      }));
      const open = splitText([item.inProgress, item.followUps, item.risksIssues, item.tomorrowReminders, item.notes].filter(Boolean).join("；")).map((text) => ({
        date: item.date,
        week: weekLabel(item.date),
        text,
        type: "daily",
        done: false,
      }));
      return [...completed, ...open];
    });

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

function leadershipWeekReport(week, items, weekly) {
  const openFollowUps = uniqueReportItems([
    ...splitText(weekly.continuedFollowUps),
    ...items.filter((item) => !item.done).flatMap((item) => splitText(item.text)),
  ]).slice(0, 4);

  return {
    week,
    startDate: items.map((item) => item.date).filter(Boolean).sort()[0] || "",
    total: items.reduce((total, item) => total + reportQuantity(item.text), 0),
    sections: workflowSections([
      ...items,
      ...openFollowUps.map((text) => ({ text: `[TBD] ${text}`, done: false })),
      ...splitText(weekly.nextWeekPlan).map((text) => ({ text: `[Plan] ${text}`, done: false })),
    ]),
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
    sourceNote: "Source records remain read-only. This page only filters and summarizes the selected month.",
  };
}

function monthlyRecap(weeks) {
  const sectionNames = ["Product Line", "Brand", "IMC", "Julia’s Initiative", "Next Moves"];
  const sections = sectionNames.map((name) => {
    const weekSections = weeks.flatMap((week) => week.sections.filter((section) => section.title === name));
    return {
      title: name,
      total: weekSections.reduce((sum, section) => sum + section.total, 0),
      items: uniqueReportItems(weekSections.flatMap((section) => section.items)).slice(0, 3),
    };
  });
  return {
    weekCount: weeks.length,
    total: weeks.reduce((sum, week) => sum + week.total, 0),
    sections,
  };
}

function selectedWeeklyReport(monthly) {
  if (!monthly.weeks.length) return null;
  const selected = monthly.weeks.find((week) => week.week === state.selectedWeek);
  return selected || monthly.weeks[0];
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

function weeklyLeadershipCard(report, index) {
  const sections = report.sections
    .map((section) => {
      const list = section.items.length
        ? section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : "<li>No tagged records yet.</li>";
      return `
        <section>
          <h3>${escapeHtml(section.title)} <span class="section-count">${section.total}</span></h3>
          <ul>${list}</ul>
        </section>
      `;
    })
    .join("");

  return `
    <article class="weekly-report-card">
      <header class="weekly-report-header">
        <div>
          <p>Leadership Weekly Report</p>
          <h2>${escapeHtml(report.week || `Week ${index + 1}`)}</h2>
        </div>
        <strong>${report.total}</strong>
      </header>
      <p class="weekly-report-summary">This report is organized by Julia’s real workflow: Product Line, Brand, and IMC first, with quantified work embedded in each section. [JULIA], [Plan], [Idea], and [TBD] are separated so personal initiative and pending work stay visible.</p>
      <div class="weekly-report-sections">
        ${sections}
      </div>
    </article>
  `;
}

function monthlyRecapCard(monthly) {
  const recap = monthly.recap || { weekCount: 0, total: 0, sections: [] };
  const sections = recap.sections
    .map((section) => {
      const items = section.items.length
        ? section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : "<li>No records yet.</li>";
      return `
        <div class="monthly-recap-item">
          <span>${escapeHtml(section.title)}</span>
          <strong>${section.total}</strong>
          <ul class="monthly-recap-list">${items}</ul>
        </div>
      `;
    })
    .join("");

  return `
    <article class="monthly-recap-card">
      <header>
        <div>
          <p>Monthly Recap</p>
          <h2>${escapeHtml(monthly.title)}</h2>
        </div>
        <strong>${recap.total}</strong>
      </header>
      <p class="weekly-report-summary">This month includes ${recap.weekCount} tracked week${recap.weekCount === 1 ? "" : "s"}. The recap aggregates Product Line, Brand, IMC, Julia’s Initiative, and Next Moves from your Notion records.</p>
      <div class="monthly-recap-grid">${sections}</div>
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
