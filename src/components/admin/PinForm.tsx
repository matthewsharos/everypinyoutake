import { useState } from 'react';
import type { Pin, CollectedType } from '../../lib/pins';
import { uploadPinImage, type PinInput } from '../../lib/adminApi';

const TYPES: CollectedType[] = ['Collected', 'For Trade', 'ISO'];

interface Props {
  initial?: Partial<Pin>;
  submitLabel: string;
  onSubmit: (input: PinInput) => Promise<void>;
}

const field = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-sky/70';
const label = 'mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-muted';

export default function PinForm({ initial = {}, submitLabel, onSubmit }: Props) {
  const [v, setV] = useState<PinInput>({
    pin_name: initial.pin_name ?? '',
    collected_type: (initial.collected_type as CollectedType) ?? 'Collected',
    series: initial.series ?? '',
    origin: initial.origin ?? '',
    edition: initial.edition ?? '',
    year: initial.year ?? null,
    tags: initial.tags ?? '',
    notes: initial.notes ?? '',
    external_url: initial.external_url ?? '',
    external_pin_id: initial.external_pin_id ?? '',
    image_url: initial.image_url ?? '',
    image_url2: initial.image_url2 ?? '',
    image_url3: initial.image_url3 ?? '',
    is_limited_edition: initial.is_limited_edition ?? false,
    is_mystery: initial.is_mystery ?? false,
    is_ap: initial.is_ap ?? false,
    is_pp: initial.is_pp ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const set = <K extends keyof PinInput>(k: K, val: PinInput[K]) => setV((s) => ({ ...s, [k]: val }));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const url = await uploadPinImage(file);
      set('image_url', url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.pin_name.trim()) {
      setErr('Pin name is required.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      await onSubmit({ ...v, year: v.year ? Number(v.year) : null });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="flex gap-4">
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
          {v.image_url ? (
            <img src={v.image_url} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-2xl text-[#ddd2bf]">⬡</span>
          )}
        </div>
        <div className="flex flex-col justify-center gap-1.5">
          <label className="btn btn-ghost cursor-pointer text-sm">
            {uploading ? 'Uploading…' : v.image_url ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
          <p className="text-xs text-muted">JPG / PNG / WebP — saved to Supabase Storage.</p>
        </div>
      </div>

      <div>
        <label className={label}>Pin name *</label>
        <input className={field} value={v.pin_name} onChange={(e) => set('pin_name', e.target.value)} required />
      </div>

      <div>
        <label className={label}>Status</label>
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => set('collected_type', t)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                v.collected_type === t ? 'bg-sun text-[#4a3a0c]' : 'border border-line text-muted hover:text-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Series</label>
          <input className={field} value={v.series ?? ''} onChange={(e) => set('series', e.target.value)} />
        </div>
        <div>
          <label className={label}>Origin</label>
          <input className={field} value={v.origin ?? ''} onChange={(e) => set('origin', e.target.value)} />
        </div>
        <div>
          <label className={label}>Edition</label>
          <input className={field} value={v.edition ?? ''} onChange={(e) => set('edition', e.target.value)} placeholder="e.g. LE 300" />
        </div>
        <div>
          <label className={label}>Year</label>
          <input className={field} type="number" value={v.year ?? ''} onChange={(e) => set('year', e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>

      <div>
        <label className={label}>Tags</label>
        <input className={field} value={v.tags ?? ''} onChange={(e) => set('tags', e.target.value)} />
      </div>

      <div>
        <label className={label}>Notes</label>
        <textarea className={`${field} min-h-20`} value={v.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>External URL (PinPics)</label>
          <input className={field} value={v.external_url ?? ''} onChange={(e) => set('external_url', e.target.value)} />
        </div>
        <div>
          <label className={label}>External Pin ID</label>
          <input className={field} value={v.external_pin_id ?? ''} onChange={(e) => set('external_pin_id', e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Image URL 2</label>
          <input className={field} value={v.image_url2 ?? ''} onChange={(e) => set('image_url2', e.target.value)} />
        </div>
        <div>
          <label className={label}>Image URL 3</label>
          <input className={field} value={v.image_url3 ?? ''} onChange={(e) => set('image_url3', e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {([
          ['is_limited_edition', 'Limited Edition'],
          ['is_ap', 'Artist Proof'],
          ['is_pp', 'Pin Pal (PP)'],
          ['is_mystery', 'Mystery'],
        ] as [keyof PinInput, string][]).map(([k, lbl]) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" checked={Boolean(v[k])} onChange={(e) => set(k, e.target.checked as never)} />
            {lbl}
          </label>
        ))}
      </div>

      {err && <p className="rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta">{err}</p>}

      <div>
        <button type="submit" className="btn btn-primary" disabled={busy || uploading}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
