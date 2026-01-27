import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const orderData = await request.json();

    // Load credentials from JSON file
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), 'google-credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1MUr3yoQFTFwuRd0cEOKOHF8ke9Nd1wVYjOhnBySAvP4';

    // Format charms as a readable string
    const charmsText = orderData.charms
      .filter((c: any) => c.charmName && !c.charmName.includes('Plain'))
      .map((c: any) => `[${c.position}] ${c.charmName} (AED ${c.price.toFixed(2)})`)
      .join(', ') || 'All Plain';

    // Prepare row data
    const row = [
      orderData.customerName,
      orderData.phoneNumber,
      orderData.pickupTime,
      orderData.meetupPlace,
      orderData.deliveryDate,
      orderData.braceletSize, 
      charmsText,
      `AED ${orderData.subtotal.toFixed(2)}`,
      `AED ${orderData.deliveryFee.toFixed(2)}`,
      `AED ${orderData.total.toFixed(2)}`,
      orderData.timestamp,
    ];

    // Write headers if sheet is empty
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:L1',
    });

    if (!headerResponse.data.values || headerResponse.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:L1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'Customer Name',
            'Phone',
            'Pickup Time',
            'Meetup Place',
            'Delivery Date',
            'Size',
            'Charms',
            'Subtotal',
            'Delivery Fee',
            'Total',
            'Timestamp'
          ]],
        },
      });
    }

    // Append the order data
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A2:L',
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Order saved to Google Sheets successfully!' 
    });

  } catch (error: any) {
    console.error('Error saving to Google Sheets:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}