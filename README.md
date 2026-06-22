# Daily Work Dashboard

Private dashboard for Daily Work records in Notion, with optional fallback Google Sheet support.

## Data Source

Primary Notion sources:

- Daily Work page: `3e556556394f460591dd54bedc533cfd`
- Workflow Tasks data source: `386cbc99-c1ab-8042-a401-000bc1689dd9`

The app reads the Daily Work page as markdown and shows the current natural month only. Older Notion records are not deleted; they are just outside the default dashboard window after the month changes.

New tasks are written only to the separate Workflow Tasks database.

## Run

```bash
PORT=5175 node server.mjs
```

Open:

http://127.0.0.1:5175/

## Publish On Render

Create a Render Web Service from this project.

Use:

```bash
npm install
```

Start command:

```bash
npm start
```

Set these Render environment variables:

```bash
NOTION_TOKEN=your_notion_integration_token
NOTION_DAILY_WORK_PAGE_ID=3e556556394f460591dd54bedc533cfd
NOTION_TASKS_DATA_SOURCE_ID=386cbc99-c1ab-8042-a401-000bc1689dd9
DASHBOARD_PASSWORD=choose_a_private_password
```

The published site is private only when `DASHBOARD_PASSWORD` is set. Keep `NOTION_TOKEN` secret and never place it in front-end code.

## Save New Tasks To Notion

Daily Work source records stay read-only. The `New Task` form can create new rows only in the separate `Workflow Tasks` Notion database when a Notion API token is configured.

Default Notion Tasks data source:

```bash
386cbc99-c1ab-8042-a401-000bc1689dd9
```

Run with Notion writing enabled:

```bash
NOTION_TOKEN=your_notion_integration_token PORT=5175 node server.mjs
```

Or create `.env.local` next to `server.mjs`:

```bash
NOTION_TOKEN=your_notion_integration_token
NOTION_DAILY_WORK_PAGE_ID=3e556556394f460591dd54bedc533cfd
NOTION_TASKS_DATA_SOURCE_ID=386cbc99-c1ab-8042-a401-000bc1689dd9
```

Then double-click `Start Daily Work Dashboard.command`.

Optional override:

```bash
NOTION_TASKS_DATA_SOURCE_ID=your_data_source_id NOTION_TOKEN=your_token PORT=5175 node server.mjs
```

## Configure Another Sheet

The Google Sheet path is only a fallback when Notion is not configured.

```bash
WORKFLOW_SPREADSHEET_ID=your_spreadsheet_id PORT=5175 node server.mjs
```

## Safety Notes

- Daily Work records are read-only
- New tasks write only to the separate Workflow Tasks database
- If Notion is not configured, the browser keeps the task as a local draft
- If Notion cannot sync, confirm the connection is shared with both the Daily Work page and the Workflow Tasks database
