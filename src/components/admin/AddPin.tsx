import { useState } from 'react';
import type { Pin, CollectedType } from '../../lib/pins';
import { addFromArchive, addManual, searchArchive } from '../../lib/adminApi';
import PinForm from './PinForm';

const TYPES: CollectedType[] = ['Collected', 'For Trade', 'ISO'];

function thumb(p: Pin) {
  return p.image_url || p.image_url2 || p.image_url3 || null;
}

export default function AddPin() {
  const [mode, setMode] = useState<'archive' | 'manual'>('archive');

  // archive
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addType, setAddType] = useState<CollectedType>('Collected');
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');

  // manual
  const [formKey, setFormKey] = useState(0);
  const [manualMsg, setManualMsg] = useState('');

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr('');
    setLoading(true);
    setSearched(true);
    try {
      setResults(await searchArchive(q));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const add = async (p: Pin) => {
    setErr('');
    setBusyId(p.id);
    try {
      await addFromArchive(p, addType);
      setAdded((a) => ({ ...a, [p.id]: true }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Add failed.');
    } finally {
      setBusyId(null);
    }
  };

  const submitManual = async (input: Parameters<typeof addManual>[0]) => {
    await addManual(input);
    setManualMsg('Pin added to the collection. ✓');
    setFormKey((k) => k + 1);
  };

  const modeBtn = (m: typeof mode, label: string) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition ${
      mode === m ? 'bg-sun text-[#4a3a0c]' : 'text-muted hover:text-text'
    }`;

  return (
    <div>
      <div className="mb-6 inline-flex items-center gap-1 rounded-full border border-line bg-white/60 p-1">
        <button className={modeBtn('archive', 'archive')} onClick={() => setMode('archive')}>From archive</button>
        <button className={modeBtn('manual', 'manual')} onClick={() => setMode('manual')}>Manual entry</button>
      </div>

      {err && <p className="mb-4 rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta">{err}</p>}

      {mode === 'archive' ? (
        <div>
          <form onSubmit={runSearch} className="mb-4 flex flex-wrap items-center gap-3">
            <input
              className="min-w-60 flex-1 rounded-full border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-sky/70"
              placeholder="Search the archive catalog — name, series, origin…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </form>

          <div className="mb-5 flex items-center gap-2 text-sm">
            <span className="text-muted">Add as:</span>
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setAddType(t)}
                className={`rounded-full px-3 py-1 font-semibold transition ${
                  addType === t ? 'bg-sun text-[#4a3a0c]' : 'border border-line text-muted hover:text-text'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {searched && !loading && results.length === 0 && (
            <p className="text-muted">No archive pins match “{q}”.</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => (
              <div key={p.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
                  {thumb(p) ? <img src={thumb(p)!} alt="" className="h-full w-full object-contain p-1" /> : <span className="text-xl text-[#ddd2bf]">⬡</span>}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="line-clamp-2 text-sm font-semibold">{p.pin_name}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                    {[p.series, p.edition, p.year].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-auto pt-2">
                    {added[p.id] ? (
                      <span className="text-sm font-semibold text-[#2f8f7c]">Added ✓</span>
                    ) : (
                      <button onClick={() => add(p)} className="btn btn-ghost text-sm" disabled={busyId === p.id}>
                        {busyId === p.id ? 'Adding…' : '+ Add'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-2xl">
          {manualMsg && <p className="mb-4 rounded-lg bg-[#2f8f7c]/10 px-3 py-2 text-sm text-[#2f8f7c]">{manualMsg}</p>}
          <PinForm key={formKey} submitLabel="Add pin" onSubmit={submitManual} />
        </div>
      )}
    </div>
  );
}
