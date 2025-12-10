import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const allowedExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// UPDATED: allows parentheses
function isSafeFilename(name: string) {
  if (!name || typeof name !== 'string') return false;

  // disallow slashes to prevent directory traversal
  if (name.includes('/') || name.includes('\\')) return false;

  // check extension
  const ext = path.extname(name).toLowerCase();
  if (!allowedExt.includes(ext)) return false;

  // allow: letters, numbers, spaces, underscore, dash, dot, parentheses
  return /^[\w \-.\(\)]+\.[a-z0-9]+$/i.test(name);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { oldName, newName, overwrite } = body || {};

    // Filename validation
    if (!isSafeFilename(oldName) || !isSafeFilename(newName)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const charmsDir = path.join(process.cwd(), 'public', 'charms');
    const oldPath = path.join(charmsDir, oldName);
    const newPath = path.join(charmsDir, newName);

    // Prevent directory escape
    if (!oldPath.startsWith(charmsDir) || !newPath.startsWith(charmsDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Check if old file exists
    try {
      await fs.promises.access(oldPath, fs.constants.F_OK);
    } catch {
      return NextResponse.json({ error: 'Source file not found' }, { status: 404 });
    }

    // If target exists and overwrite is true, delete it
    try {
      await fs.promises.access(newPath, fs.constants.F_OK);
      if (overwrite) {
        await fs.promises.unlink(newPath);
      } else {
        return NextResponse.json({ error: 'Target filename already exists' }, { status: 409 });
      }
    } catch {
      // new file does not exist (this is good)
    }

    // Rename file
    await fs.promises.rename(oldPath, newPath);

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
