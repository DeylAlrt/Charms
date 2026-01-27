import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const SPREADSHEET_ID = '1MUr3yoQFTFwuRd0cEOKOHF8ke9Nd1wVYjOhnBySAvP4';
const STOCK_SHEET = 'Stock';
const ORDERS_SHEET = 'Sheet1';

async function getGoogleSheets() {
  let credentials;
  
  if (process.env.GOOGLE_CREDENTIALS) {
    // Production: use environment variable
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } else {
    // Local: read file using fs
    const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  }
    
  const auth = new google.auth.GoogleAuth({
    credentials,
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

// Handle stock update
async function handleStockUpdate(data: { charmName: string; quantity: number }) {
  const { charmName, quantity } = data;

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
  const newQty = Math.max(0, parseInt(quantity) || 0);

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
}

// Handle order submission
async function handleOrderSubmission(orderData: any) {
  const {
    customerName,
    phone,
    pickupTime,
    meetupPlace,
    deliveryDate,
    size,
    charms,
    subtotal,
    deliveryFee,
    total
  } = orderData;

  if (!customerName || !phone) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields' },
      { status: 400 }
    );
  }

  const sheets = await getGoogleSheets();

  // Append order to Sheet1
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORDERS_SHEET}!A:I`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        customerName,
        phone,
        pickupTime,
        meetupPlace,
        deliveryDate,
        size,
        charms, // This will be a string representation of the charms
        subtotal,
        total
      ]],
    },
  });

  return NextResponse.json({ 
    success: true,
    message: 'Order submitted successfully!' 
  });
}

// POST - Handle both stock updates and order submissions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if this is a stock update
    if (body.charmName !== undefined && body.quantity !== undefined) {
      return await handleStockUpdate(body);
    }
    
    // Check if this is an order submission
    if (body.orderData) {
      return await handleOrderSubmission(body.orderData);
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid request format' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Error in POST handler:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}