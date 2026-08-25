import { getGoogleSheets, ensureSheetExists, SPREADSHEET_ID } from './googleSheets';

const SHEET_NAME = 'PendingPayments';
const HEADER = ['Payment Intent ID', 'Status', 'Order Data (JSON)', 'Created At'];

/**
 * Ziina payment intents carry no custom metadata field, so there's no
 * built-in way to know which order a given payment ID belongs to once the
 * webhook fires. This sheet is that correlation: the full order (customer
 * details + charm selection + computed totals) is stashed here, keyed by
 * payment intent ID, the moment the intent is created — then looked back
 * up once the webhook confirms payment actually completed.
 */

export type PendingOrder = {
  emailParams: Record<string, string>;
  sheetOrderData: Record<string, string>;
};

export async function savePendingPayment(paymentIntentId: string, order: PendingOrder): Promise<void> {
  const sheets = await getGoogleSheets();
  await ensureSheetExists(sheets, SHEET_NAME, HEADER);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:D`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[paymentIntentId, 'pending', JSON.stringify(order), new Date().toISOString()]],
    },
  });
}

/** Returns the pending order + its row number (1-indexed), or null if not found or already processed. */
export async function findPendingPayment(
  paymentIntentId: string
): Promise<{ rowNumber: number; status: string; order: PendingOrder } | null> {
  const sheets = await getGoogleSheets();
  await ensureSheetExists(sheets, SHEET_NAME, HEADER);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:D`,
  });

  const rows: string[][] = response.data.values || [];
  const index = rows.findIndex((row) => row[0] === paymentIntentId);
  if (index === -1) return null;

  const [, status, orderJson] = rows[index];
  return {
    rowNumber: index + 2, // +2: 1-indexed, and row 1 is the header
    status,
    order: JSON.parse(orderJson),
  };
}

export async function markPendingPaymentStatus(rowNumber: number, status: string): Promise<void> {
  const sheets = await getGoogleSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!B${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] },
  });
}
