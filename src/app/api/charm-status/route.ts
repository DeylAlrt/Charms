import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isAdminRequest } from '@/lib/adminAuth';

const filePath = path.join(process.cwd(), 'charm-out-of-stock.json');

/** Map of charm filename -> true if manually marked out of stock. Charms absent from this map are in stock. */
type OutOfStockMap = Record<string, boolean>;

function readStatuses(): OutOfStockMap {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error('Error reading charm-out-of-stock.json:', error);
    return {};
  }
}

function writeStatuses(statuses: OutOfStockMap) {
  fs.writeFileSync(filePath, JSON.stringify(statuses, null, 2));
}

export async function GET() {
  return NextResponse.json(readStatuses());
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { filename, outOfStock } = await req.json();
    if (!filename || typeof outOfStock !== 'boolean') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const statuses = readStatuses();
    if (outOfStock) {
      statuses[filename] = true;
    } else {
      delete statuses[filename]; // keep the file small: only store the exceptions
    }
    writeStatuses(statuses);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing charm-out-of-stock.json:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
