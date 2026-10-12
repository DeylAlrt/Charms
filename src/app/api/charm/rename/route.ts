import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isAdminRequest } from '@/lib/adminAuth';
import { isSafeCharmPath, resolveCharmPath } from '@/lib/charmPaths';

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { oldName, newName, overwrite } = body || {};

    // Filename validation
    if (!isSafeCharmPath(oldName) || !isSafeCharmPath(newName)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Prevent directory escape
    const oldPath = resolveCharmPath(oldName);
    const newPath = resolveCharmPath(newName);
    if (!oldPath || !newPath) {
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

    // Rename file (possibly into another folder)
    await fs.promises.mkdir(path.dirname(newPath), { recursive: true });
    await fs.promises.rename(oldPath, newPath);

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
