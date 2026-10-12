import path from 'path';

const allowedExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

export const CHARMS_DIR = path.join(process.cwd(), 'public', 'charms');

/**
 * Accepts a charm image path relative to public/charms, either a bare
 * filename or one folder deep ("Flag Links/Flags (1).png").
 */
export function isSafeCharmPath(name: unknown): name is string {
  if (!name || typeof name !== 'string') return false;
  if (name.includes('\\')) return false;

  const segments = name.split('/');
  if (segments.length > 2) return false;
  // allow: letters, numbers, spaces, underscore, dash, dot, parentheses — but no "." / ".." segments
  if (segments.some(s => !/^[\w \-.\(\)]+$/.test(s) || /^\.+$/.test(s.trim()))) return false;

  const ext = path.extname(name).toLowerCase();
  if (!allowedExt.includes(ext)) return false;
  return /^[\w \-.\(\)]+\.[a-z0-9]+$/i.test(segments[segments.length - 1]);
}

/** Absolute path for a validated charm path, or null if it would escape public/charms. */
export function resolveCharmPath(name: string): string | null {
  const resolved = path.join(CHARMS_DIR, name);
  return resolved.startsWith(CHARMS_DIR + path.sep) ? resolved : null;
}
