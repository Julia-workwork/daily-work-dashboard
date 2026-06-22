import { parseCsvRows } from "./csv.mjs";
import { DEFAULT_SPREADSHEET_ID, DEFAULT_SPREADSHEET_URL } from "./workflow-domain.mjs";

export const TAB_CONFIG = {
  dailyExtracts: "Daily Extract",
  tasks: "Task Tracker",
  weeklyReview: "Weekly Review",
  categorySummary: "Category Summary",
  settings: "Settings",
};

export function sheetCsvUrl(spreadsheetId, sheetName) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

async function fetchTab(spreadsheetId, sheetName, fetchImpl) {
  const response = await fetchImpl(sheetCsvUrl(spreadsheetId, sheetName));
  if (!response.ok) {
    throw new Error(
      `Google Sheet tab "${sheetName}" is not readable through CSV export (${response.status}). Share the sheet with link-view access or configure a future server-side Google API credential path.`,
    );
  }
  return parseCsvRows(await response.text());
}

export async function fetchWorkflowTabs(options = {}) {
  const spreadsheetId = options.spreadsheetId || process.env.WORKFLOW_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  const fetchImpl = options.fetchImpl || fetch;
  const entries = await Promise.all(
    Object.entries(TAB_CONFIG).map(async ([key, sheetName]) => [key, await fetchTab(spreadsheetId, sheetName, fetchImpl)]),
  );
  return Object.fromEntries(entries);
}

export function workflowSource(options = {}) {
  const spreadsheetId = options.spreadsheetId || process.env.WORKFLOW_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    configuredUrl: DEFAULT_SPREADSHEET_URL,
  };
}
