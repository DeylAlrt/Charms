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
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const filename = form.get('filename') as string | null;
    const overwrite = String(form.get('overwrite') ?? '') === 'true';

    if (!file || !filename) {
      return NextResponse.json({ error: 'Missing file or filename' }, { status: 400 });
    }

    if (!isSafeFilename(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const charmsDir = path.join(process.cwd(), 'public', 'charms');
    const destPath = path.join(charmsDir, filename);

    if (!destPath.startsWith(charmsDir)) {
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
    await fs.promises.writeFile(destPath, buffer);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
