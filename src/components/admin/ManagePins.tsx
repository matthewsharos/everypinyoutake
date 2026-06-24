import { useEffect, useState } from 'react';
import type { Pin, CollectedType } from '../../lib/pins';
import { removeFromCollection, searchCollection, setType, updatePin, type PinInput } from '../../lib/adminApi';
import PinForm from './PinForm';

const TYPES: CollectedType[] = ['Collected', 'For Trade', 'ISO'];

function thumb(p: Pin) {
  return p.image_url || p.image_url2 || p.image_url3 || null;
}

export default function ManagePins() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<CollectedType | undefined>(undefined);
  const [rows, setRows] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<Pin | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr('');
    setLoading(true);
    try {
      setRows(await searchCollection(q, filter));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  // Search-as-you-type (debounced) + reload on filter change. An empty box
  // browses everything; a single letter waits for the next keystroke.
  useEffect(() => {
    if (q.trim().length === 1) return;
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter]);

  const relabel = async (p: Pin, t: CollectedType) => {
    if (p.collected_type === t) return;
    setBusyId(p.id);
    setErr('');
    try {
      await setType(p.id, t);
      setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, collected_type: t } : r)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (p: Pin) => {
    if (!confirm(`Remove “${p.pin_name}” from the collection?\n\nIt stays in your archive catalog and can be re-added.`)) return;
    setBusyId(p.id);
    setErr('');
    try {
      await removeFromCollection(p);
      setRows((rs) => rs.filter((r) => r.id !== p.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Remove failed.');
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async (input: PinInput) => {
    if (!editing) return;
    const updated = await updatePin(editing.id, input);
    setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    setEditing(null);
  };

  const typeClass = (t: string | null) =>
    t === 'For Trade' ? 'type-trade' : t === 'ISO' ? 'type-iso' : 'type-collected';

  return (
    <div>
      <form onSubmit={load} className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="min-w-60 flex-1 rounded-full border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-sky/70"
          placeholder="Search the collection…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => setFilter(undefined)} className={`rounded-full px-3 py-1 font-semibold transition ${!filter ? 'bg-sun text-[#4a3a0c]' : 'border border-line text-muted hover:text-text'}`}>All</button>
        {TYPES.map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`rounded-full px-3 py-1 font-semibold transition ${filter === t ? 'bg-sun text-[#4a3a0c]' : 'border border-line text-muted hover:text-text'}`}>{t}</button>
        ))}
      </div>

      {err && <p className="mb-4 rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta">{err}</p>}
      {!loading && rows.length === 0 && <p className="text-muted">No pins found.</p>}

      <div className="grid gap-2.5">
        {rows.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
              {thumb(p) ? <img src={thumb(p)!} alt="" className="h-full w-full object-contain p-1" /> : <span className="text-lg text-[#ddd2bf]">⬡</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold">{p.pin_name}</p>
              <p className="line-clamp-1 text-xs text-muted">{[p.series, p.edition, p.year].filter(Boolean).join(' · ')}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => relabel(p, t)}
                    disabled={busyId === p.id}
                    className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold transition ${p.collected_type === t ? typeClass(t) : 'border border-line text-muted hover:text-text'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button onClick={() => setEditing(p)} className="btn btn-ghost px-3 py-1.5 text-xs">Edit</button>
              <button onClick={() => remove(p)} disabled={busyId === p.id} className="px-3 py-1 text-xs font-semibold text-magenta hover:underline">Remove</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 sm:p-6">
          <button aria-label="Close" tabIndex={-1} onClick={() => setEditing(null)} className="fixed inset-0 cursor-default bg-[rgba(42,36,28,0.55)] backdrop-blur-sm" />
          <div className="relative z-10 my-4 w-full max-w-2xl rounded-3xl bg-surface p-6 shadow-2xl sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Edit pin</h2>
              <button onClick={() => setEditing(null)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-white hover:text-text">✕</button>
            </div>
            <PinForm key={editing.id} initial={editing} submitLabel="Save changes" onSubmit={saveEdit} />
          </div>
        </div>
      )}
    </div>
  );
}
