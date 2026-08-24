import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

export const SPREADSHEET_ID = '1MUr3yoQFTFwuRd0cEOKOHF8ke9Nd1wVYjOhnBySAvP4';

/**
 * Shared Google Sheets client. Reads the service account credentials from
 * GOOGLE_CREDENTIALS in production, or google-credentials.json locally.
 */
export async function getGoogleSheets() {
  let credentials;

  if (process.env.GOOGLE_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } else {
    const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/** Ensures a sheet tab exists, creating it with the given header row if not. */
export async function ensureSheetExists(sheets: any, sheetName: string, headerRow: string[]) {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:${String.fromCharCode(64 + headerRow.length)}1`,
    });
  } catch {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:${String.fromCharCode(64 + headerRow.length)}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headerRow] },
      });
    } catch (createError) {
      console.error(`Error creating ${sheetName} sheet:`, createError);
    }
  }
}
