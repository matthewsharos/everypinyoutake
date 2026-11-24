import type { Pin, CollectedType } from './pins';

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

async function readArchive(params: URLSearchParams): Promise<Pin[]> {
  const response = await fetch(`/api/admin/archive?${params}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Unable to load the pin archive.');
  return data.pins;
}

/** Search the reference catalog to add pins from. */
export function searchArchive(q: string, limit = 90, offset = 0): Promise<Pin[]> {
  return readArchive(new URLSearchParams({ q, limit: String(limit), offset: String(offset) }));
}

/** Newest addable PinPics archive rows for the admin landing view. */
export function recentArchivePins(limit = 18): Promise<Pin[]> {
  return readArchive(new URLSearchParams({ limit: String(limit) }));
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

export async function deletePin(id: number): Promise<Pin> {
  return (await mutate('delete', { id })).pin as Pin;
}

export async function deletePins(ids: number[]): Promise<Pick<Pin, 'id'>[]> {
  return (await mutate('bulkDelete', { ids })).pins as Pick<Pin, 'id'>[];
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
