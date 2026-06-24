// One-off / re-runnable: generate optimized WebP grid thumbnails for every pin
// image and store them in the `thumbs/` prefix of the pin-images bucket, under
// the same base filename as the original. src/lib/pins.ts thumbUrl() derives the
// thumb URL from the original by the same convention.
//
// Dry run (lists what would be generated, uploads nothing):
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/generate-thumbs.mjs
// Apply:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/generate-thumbs.mjs --apply
//
// Re-runnable: skips thumbs that already exist (use --force to regenerate).
// Requires `sharp` (devDependency).

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.PUBLIC_SUPABASE_URL || 'https://jbjwuudoeueujsmkvyeh.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const BUCKET = 'pin-images';
const MAX_DIM = 640;
const QUALITY = 75;
const MARKER = `/${BUCKET}/`;

// Map an original public URL to its in-bucket thumb storage path, mirroring the
// original's path under a `thumbs/` prefix with a .webp extension. Must match
// thumbUrl() in src/lib/pins.ts. e.g.
//   https://…/pin-images/12342/abc.png  ->  thumbs/12342/abc.webp
function thumbPath(publicUrl) {
  const i = publicUrl.indexOf(MARKER);
  if (i === -1) return null;
  const rel = publicUrl.slice(i + MARKER.length).replace(/\?.*$/, '');
  if (!rel || rel.startsWith('thumbs/')) return null;
  return `thumbs/${rel.replace(/\.[a-z0-9]+$/i, '')}.webp`;
}

async function exists(path) {
  const slash = path.lastIndexOf('/');
  const dir = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data } = await sb.storage.from(BUCKET).list(dir, { search: name, limit: 1 });
  return !!data?.some((f) => f.name === name);
}

// Collect every distinct original image URL across the collection. Supabase caps
// a single select at 1000 rows, so page through the whole table explicitly.
const pins = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb
    .from('pins')
    .select('image_url,image_url2,image_url3')
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error('Failed to load pins:', error.message);
    process.exit(1);
  }
  pins.push(...(data ?? []));
  if (!data || data.length < PAGE) break;
}

const urls = [
  ...new Set(
    pins.flatMap((p) => [p.image_url, p.image_url2, p.image_url3]).filter(Boolean),
  ),
];
const targets = urls.map((u) => ({ u, path: thumbPath(u) })).filter((t) => t.path);
const skipped = urls.length - targets.length;

console.log(
  `${urls.length} image URLs · ${targets.length} in pin-images bucket · ${skipped} external/legacy (skipped)`,
);
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}${FORCE ? ' --force' : ''} · ${MAX_DIM}px WebP q${QUALITY}\n`);

let made = 0;
let already = 0;
let failed = 0;

for (const { u, path } of targets) {
  if (!FORCE && (await exists(path))) {
    already++;
    continue;
  }
  if (!APPLY) {
    console.log(`would generate  ${path}`);
    made++;
    continue;
  }
  try {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());
    const out = await sharp(input)
      .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, out, { cacheControl: '31536000', upsert: true, contentType: 'image/webp' });
    if (upErr) throw upErr;
    made++;
    if (made % 25 === 0) console.log(`  …${made} generated`);
  } catch (e) {
    failed++;
    console.warn(`FAILED  ${u} -> ${path}: ${e.message}`);
  }
}

console.log(
  `\nDone. ${made} ${APPLY ? 'generated' : 'to generate'} · ${already} already existed · ${failed} failed.`,
);
if (!APPLY) console.log('Re-run with --apply to write thumbnails.');
