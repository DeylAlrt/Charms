import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1MUr3yoQFTFwuRd0cEOKOHF8ke9Nd1wVYjOhnBySAvP4';
const STOCK_SHEET = 'Stock';

async function getGoogleSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'google-credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureStockSheetExists(sheets: any) {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${STOCK_SHEET}!A1:C1`,
    });
  } catch (error) {
    // Create the sheet if it doesn't exist
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: STOCK_SHEET
              }
            }
          }]
        }
      });

      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${STOCK_SHEET}!A1:C1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Charm Name', 'Stock Quantity', 'Last Updated']],
        },
      });
    } catch (createError) {
      console.error('Error creating stock sheet:', createError);
    }
  }
}

// GET - Fetch all stock data
export async function GET() {
  try {
    const sheets = await getGoogleSheets();
    await ensureStockSheetExists(sheets);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${STOCK_SHEET}!A2:C`,
    });

    const rows = response.data.values || [];
    const stockData: Record<string, number> = {};
    
    rows.forEach((row: any[]) => {
      if (row[0]) {
        stockData[row[0]] = parseInt(row[1]) || 0;
      }
    });

    return NextResponse.json({ success: true, stock: stockData });

  } catch (error: any) {
    console.error('Error fetching stock:', error);
    return NextResponse.json(
      { success: false, error: error.message, stock: {} },
      { status: 500 }
    );
  }
}

// POST - Update stock for a specific charm
export async function POST(request: NextRequest) {
  try {
    const { charmName, quantity } = await request.json();

    if (!charmName || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing charmName or quantity' },
        { status: 400 }
      );
    }

    const sheets = await getGoogleSheets();
    await ensureStockSheetExists(sheets);

    // Get current stock data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${STOCK_SHEET}!A2:C`,
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    // Find if charm already exists
    rows.forEach((row: any[], index: number) => {
      if (row[0] === charmName) {
        rowIndex = index + 2; // +2 because A2 is row 2
      }
    });

    const timestamp = new Date().toISOString();
    const newQty = Math.max(0, parseInt(quantity) || 0); // Ensure non-negative

    if (rowIndex > 0) {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${STOCK_SHEET}!A${rowIndex}:C${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[charmName, newQty, timestamp]],
        },
      });
    } else {
      // Add new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${STOCK_SHEET}!A2:C`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[charmName, newQty, timestamp]],
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      charmName,
      quantity: newQty,
      message: 'Stock updated successfully!' 
    });

  } catch (error: any) {
    console.error('Error updating stock:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}