import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'base-colors.json');

interface ColorStatus {
  [color: string]: boolean; // true if available, false if sold out
}

const defaultColors: ColorStatus = {
  Silver: true,
  Gold: true,
  Blue: true,
  Black: true,
  Brown: true,
  Red: true,
  Purple: true,
  Pink: true,
};

function readColors(): ColorStatus {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultColors, null, 2));
      return defaultColors;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading colors:', error);
    return defaultColors;
  }
}

function writeColors(colors: ColorStatus) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(colors, null, 2));
  } catch (error) {
    console.error('Error writing colors:', error);
  }
}

export async function GET() {
  const colors = readColors();
  return NextResponse.json(colors);
}

export async function POST(request: NextRequest) {
  try {
    const { color, soldOut } = await request.json();
    if (!color || typeof soldOut !== 'boolean') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    const colors = readColors();
    colors[color] = !soldOut; // soldOut true means available false
    writeColors(colors);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}