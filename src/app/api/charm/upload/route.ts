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
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const filename = form.get('filename') as string | null;
    const overwrite = String(form.get('overwrite') ?? '') === 'true';

    if (!file || !filename) {
      return NextResponse.json({ error: 'Missing file or filename' }, { status: 400 });
    }

    if (!isSafeCharmPath(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const destPath = resolveCharmPath(filename);
    if (!destPath) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    try {
      await fs.promises.access(destPath, fs.constants.F_OK);
      if (!overwrite) {
        return NextResponse.json({ error: 'File exists' }, { status: 409 });
      }
    } catch (e) {
      // file doesn't exist, ok
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.writeFile(destPath, buffer);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
