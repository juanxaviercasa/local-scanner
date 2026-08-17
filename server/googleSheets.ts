import { importPKCS8, SignJWT } from "jose";
import { ENV } from "./_core/env";

type ServiceAccount = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

export type SheetExportRow = Record<string, unknown>;

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function safelyRenderCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string") return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

export function rowsToSheetValues(rows: SheetExportRow[]) {
  const headers = Object.keys(rows[0] ?? {});
  return {
    headers,
    values: rows.map(row => headers.map(header => safelyRenderCell(row[header]))),
  };
}

function integrationConfiguration() {
  if (!ENV.paidConnectorsEnabled) {
    throw new Error("Google Sheets está inactivo como placeholder. Activa NEXO_ENABLE_PAID_CONNECTORS=true junto con las credenciales para usar este conector.");
  }
  if (!ENV.googleServiceAccountJson || !ENV.googleSheetsSpreadsheetId) {
    throw new Error("Google Sheets no está configurado. Añade la cuenta de servicio y el ID de la hoja desde los secretos del proyecto.");
  }
  let account: ServiceAccount;
  try {
    account = JSON.parse(ENV.googleServiceAccountJson) as ServiceAccount;
  } catch {
    throw new Error("La cuenta de servicio de Google Sheets no contiene JSON válido.");
  }
  if (!account.client_email || !account.private_key) throw new Error("La cuenta de servicio de Google Sheets no incluye client_email y private_key.");
  return { account, spreadsheetId: ENV.googleSheetsSpreadsheetId, tab: ENV.googleSheetsTab || "Prospectos" };
}

async function googleAccessToken(account: ServiceAccount) {
  const signingKey = await importPKCS8(account.private_key!, "RS256");
  const assertion = await new SignJWT({ scope: SHEETS_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email!)
    .setAudience(account.token_uri || TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(signingKey);
  const response = await fetch(account.token_uri || TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error_description || "Google no emitió un token para la cuenta de servicio.");
  return body.access_token;
}

async function sheetsRequest(url: string, token: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    const json = await response.json().catch(() => ({})) as { error?: { message?: string } };
    if (!response.ok) throw new Error(json.error?.message || `Google Sheets respondió con estado ${response.status}.`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export function isGoogleSheetsConfigured() {
  return Boolean(ENV.paidConnectorsEnabled && ENV.googleServiceAccountJson && ENV.googleSheetsSpreadsheetId);
}

export async function appendRowsToGoogleSheet(rows: SheetExportRow[]) {
  if (!rows.length) throw new Error("No hay prospectos seleccionados para exportar.");
  const { account, spreadsheetId, tab } = integrationConfiguration();
  const token = await googleAccessToken(account);
  const range = `${tab}!A1`;
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values`;
  const { headers, values } = rowsToSheetValues(rows);
  const headerCheck = await sheetsRequest(`${base}/${encodeURIComponent(`${tab}!1:1`)}`, token);
  if (!Array.isArray((headerCheck as { values?: unknown[][] }).values) || !(headerCheck as { values?: unknown[][] }).values?.length) {
    await sheetsRequest(`${base}/${encodeURIComponent(range)}?valueInputOption=RAW`, token, {
      method: "PUT",
      body: JSON.stringify({ majorDimension: "ROWS", values: [headers] }),
    });
  }
  const appended = await sheetsRequest(`${base}/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, token, {
    method: "POST",
    body: JSON.stringify({ majorDimension: "ROWS", values }),
  }) as { updates?: { updatedRange?: string; updatedRows?: number } };
  return {
    destinationLabel: tab,
    externalReference: appended.updates?.updatedRange ?? `${tab}!A:A`,
    rowsWritten: appended.updates?.updatedRows ?? rows.length,
  };
}
