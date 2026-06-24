// One-off: permanently clean PinPics set-roster junk from pins.notes.
//
// Dry run (prints sample changes, writes nothing):
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/clean-notes.mjs
// Apply (snapshots to pins_backup first, then updates):
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/clean-notes.mjs --apply
//
// Mirrors src/lib/notes.ts cleanNotes() exactly.

import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL || 'https://jbjwuudoeueujsmkvyeh.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const APPLY = process.argv.includes('--apply');

function cleanNotes(notes) {
  if (!notes) return null;
  let s = notes.replace(/\s+/g, ' ').trim();
  const idMatch = s.match(/#\s*\d{3,}/);
  if (idMatch && idMatch.index !== undefined) {
    let head = s.slice(0, idMatch.index);
    const sentence = head.match(/^(.*[.!?”"])\s+\S/);
    if (sentence && sentence[1].length > 20) head = sentence[1];
    s = head;
  }
  s = s.replace(/\s*(Set|Series\s*\d*)\s*:\s*$/i, '');
  s = s.replace(/[\s,|–-]+$/g, '').trim();
  return s || null;
}

if (APPLY) {
  process.stdout.write('Snapshotting pins to pins_backup… ');
  const { error } = await sb.rpc('snapshot_pins', { p_kind: 'pre-notes-clean' });
  console.log(error ? `(skipped: ${error.message})` : 'done');
}

let from = 0;
const size = 1000;
let total = 0;
let changed = 0;
let shown = 0;
while (true) {
  const { data, error } = await sb
    .from('pins')
    .select('id,notes')
    .not('notes', 'is', null)
    .order('id')
    .range(from, from + size - 1);
  if (error) throw error;
  if (!data.length) break;
  for (const p of data) {
    total++;
    const cleaned = cleanNotes(p.notes);
    if (cleaned !== p.notes) {
      changed++;
      if (!APPLY && shown++ < 12) {
        console.log('\n#' + p.id);
        console.log('  BEFORE:', JSON.stringify(p.notes.slice(-120)));
        console.log('  AFTER :', JSON.stringify((cleaned || '').slice(-120)));
      }
      if (APPLY) {
        const { error: e2 } = await sb.from('pins').update({ notes: cleaned }).eq('id', p.id);
        if (e2) console.error('  update failed', p.id, e2.message);
      }
    }
  }
  from += size;
}

console.log(`\n${changed} of ${total} notes ${APPLY ? 'updated.' : 'would change (dry run). Re-run with --apply to write.'}`);
