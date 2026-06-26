import { supabaseBrowser as sb } from './supabaseBrowser';
import type { Pin, CollectedType } from './pins';

const SELECT =
  'id,pin_name,image_url,image_url2,image_url3,year,series,origin,edition,tags,notes,external_url,external_pin_id,is_limited_edition,is_mystery,is_ap,is_pp,collected_type,created_at';

const CARD_SELECT =
  'id,pin_name,image_url,image_url2,image_url3,year,series,origin,edition,external_url,external_pin_id,is_limited_edition,is_mystery,is_ap,is_pp,created_at';

const SEARCH_FIELDS = ['pin_name', 'series', 'origin', 'edition', 'tags', 'notes'];

export interface PinInput {
  pin_name: string;
  collected_type: CollectedType;
  series?: string | null;
  origin?: string | null;
  edition?: string | null;
  year?: number | null;
  tags?: string | null;
  notes?: string | null;
  external_url?: string | null;
  external_pin_id?: string | null;
  image_url?: string | null;
  image_url2?: string | null;
  image_url3?: string | null;
  is_limited_edition?: boolean;
  is_mystery?: boolean;
  is_ap?: boolean;
  is_pp?: boolean;
}

function orFilter(q: string): string | null {
  const s = q.replace(/[%,()]/g, ' ').trim();
  return s ? SEARCH_FIELDS.map((f) => `${f}.ilike.%${s}%`).join(',') : null;
}

// ---- Reads (public anon client) -------------------------------------------

/** Search the reference catalog (admin-only) to add pins from. */
export async function searchArchive(q: string, limit = 90, offset = 0): Promise<Pin[]> {
  const s = q.trim();
  const { data: rpcData, error: rpcError } = await sb
    .rpc('search_archive', { q: s, p_limit: limit, p_offset: offset })
    .select(CARD_SELECT);
  if (!rpcError && Array.isArray(rpcData)) return rpcData as Pin[];

  let query = sb
    .from('pin_archive')
    .select(CARD_SELECT)
    .eq('already_on_site', false)
    .range(offset, offset + limit - 1);
  const f = orFilter(s);
  if (f) query = query.or(f);
  else query = query.order('updated_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Pin[];
}

/** Newest addable PinPics archive rows for the admin landing view. */
export async function recentArchivePins(limit = 18): Promise<Pin[]> {
  const { data: rpcData, error: rpcError } = await sb
    .rpc('recent_archive_pins', { p_limit: limit })
    .select(CARD_SELECT);
  if (!rpcError && Array.isArray(rpcData)) return rpcData as Pin[];

  const { data, error } = await sb
    .from('pin_archive')
    .select(CARD_SELECT)
    .eq('already_on_site', false)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Pin[];
}

/** Search the live collection (the displayed `pins`). */
export async function searchCollection(
  q: string,
  type: CollectedType | undefined,
  limit = 60,
): Promise<Pin[]> {
  const s = q.trim();
  if (s) {
    const { data, error } = await sb.rpc('search_pins', { q: s, p_type: type ?? null, p_limit: limit, p_offset: 0 });
    if (!error && Array.isArray(data)) return data as Pin[];
  }
  let query = sb.from('pins').select(SELECT).order('created_at', { ascending: false }).limit(limit);
  if (type) query = query.eq('collected_type', type);
  const f = orFilter(s);
  if (f) query = query.or(f);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Pin[];
}

// ---- Writes (server endpoints, authorized by the admin cookie) -------------

async function mutate(op: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/admin/mutate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Action failed.');
  return data;
}

export async function addFromArchive(p: Pin, type: CollectedType): Promise<Pin> {
  return (await mutate('addFromArchive', { archiveId: p.id, pin: p, type })).pin as Pin;
}

export async function addManual(input: PinInput): Promise<Pin> {
  return (await mutate('addManual', { input })).pin as Pin;
}

export async function updatePin(id: number, patch: Partial<PinInput>): Promise<Pin> {
  return (await mutate('update', { id, patch })).pin as Pin;
}

export async function setType(id: number, type: CollectedType): Promise<void> {
  await mutate('setType', { id, type });
}

export async function removeFromCollection(p: Pin): Promise<void> {
  await mutate('remove', { pin: p });
}

/** Snapshot the whole collection into pins_backup. Returns the number of pins saved. */
export async function backupNow(): Promise<number> {
  return (await mutate('backup', {})).count as number;
}

/**
 * Downscale an image to an optimized WebP thumbnail for the catalog grid.
 * Runs in the browser via <canvas>; returns null if the image can't be decoded
 * (the upload still proceeds with just the original).
 */
async function makeThumb(file: File, maxDim = 640, quality = 0.8): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    return blob ? new File([blob], 'thumb.webp', { type: 'image/webp' }) : null;
  } catch {
    return null;
  }
}

/** Upload an image via the server (service key) and return its public URL. */
export async function uploadPinImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const thumb = await makeThumb(file);
  if (thumb) fd.append('thumb', thumb);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Upload failed.');
  return data.url as string;
}
