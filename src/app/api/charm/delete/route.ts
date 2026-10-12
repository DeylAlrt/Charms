import { NextResponse } from 'next/server';
import fs from 'fs';
import { isAdminRequest } from '@/lib/adminAuth';
import { isSafeCharmPath, resolveCharmPath } from '@/lib/charmPaths';

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { filename } = body || {};
    if (!isSafeCharmPath(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const target = resolveCharmPath(filename);
    if (!target) {
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
