import { getGoogleSheets, SPREADSHEET_ID } from './googleSheets';

const ORDERS_SHEET = 'Sheet1';

/**
 * Appends a confirmed order to the same Orders sheet/column layout that
 * the existing pay-on-pickup flow writes to (see handleOrderSubmission in
 * src/app/api/stock/route.ts) — so paid-online orders show up identically
 * to cash orders, just with an extra "Paid Online" marker in the size
 * field's sibling data if the caller includes one.
 */
export async function appendOrderToSheet(order: {
  customerName: string;
  phone: string;
  pickupTime: string;
  meetupPlace: string;
  deliveryDate: string;
  size: string;
  charms: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
}): Promise<void> {
  const sheets = await getGoogleSheets();
  const timestamp = new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORDERS_SHEET}!A:J`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        order.customerName,
        order.phone,
        order.pickupTime,
        order.meetupPlace,
        order.deliveryDate,
        order.size,
        order.charms,
        order.subtotal,
        order.deliveryFee,
        order.total,
        timestamp,
      ]],
    },
  });
}
