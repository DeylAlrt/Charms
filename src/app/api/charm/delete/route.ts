import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const allowedExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function isSafeFilename(name: string) {
  if (!name || typeof name !== 'string') return false;
  if (name.includes('/') || name.includes('\\')) return false;
  const ext = path.extname(name).toLowerCase();
  if (!allowedExt.includes(ext)) return false;
  return /^[\w \-.]+\.[a-z0-9]+$/i.test(name);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { filename } = body || {};
    if (!isSafeFilename(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const charmsDir = path.join(process.cwd(), 'public', 'charms');
    const target = path.join(charmsDir, filename);
    if (!target.startsWith(charmsDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    try {
      await fs.promises.access(target, fs.constants.F_OK);
    } catch (err) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    await fs.promises.unlink(target);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
