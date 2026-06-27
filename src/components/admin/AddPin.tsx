import { useEffect, useRef, useState } from 'react';
import type { Pin, CollectedType } from '../../lib/pins';
import { addFromArchive, addManual, recentArchivePins, searchArchive } from '../../lib/adminApi';
import PinForm from './PinForm';
import { useToast } from './Toast';

const TYPES: CollectedType[] = ['Collected', 'For Trade', 'ISO'];
const PAGE_SIZE = 90;
const RECENT_LIMIT = 18;

function storageRenderThumb(url: string | null): string | null {
  if (!url) return null;
  const marker = '/storage/v1/object/public/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const rendered = url.slice(0, i) + '/storage/v1/render/image/public/' + url.slice(i + marker.length);
  return `${rendered}${rendered.includes('?') ? '&' : '?'}width=180&quality=72&resize=contain`;
}

function imageFor(p: Pin) {
  const full = p.image_url || p.image_url2 || p.image_url3 || null;
  return { full, src: storageRenderThumb(full) };
}

function fallbackToFullImage(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const full = img.dataset.full;
  if (!full || img.src === full) return;
  img.dataset.full = '';
  img.src = full;
}

export default function AddPin() {
  const toast = useToast();
  const [mode, setMode] = useState<'archive' | 'manual'>('archive');
  const requestSeq = useRef(0);

  // archive
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [addType, setAddType] = useState<CollectedType>('Collected');
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');

  // manual
  const [formKey, setFormKey] = useState(0);

  const loadNewest = async () => {
    const seq = ++requestSeq.current;
    setErr('');
    setLoading(true);
    setSearched(false);
    setHasMore(false);
    try {
      const rows = await recentArchivePins(RECENT_LIMIT);
      if (seq === requestSeq.current) setResults(rows);
    } catch (e) {
      if (seq === requestSeq.current) setErr(e instanceof Error ? e.message : 'Recent pins failed to load.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  const runSearch = async (e?: React.FormEvent, nextQ = q) => {
    e?.preventDefault();
    const s = nextQ.trim();
    if (!s) {
      await loadNewest();
      return;
    }
    const seq = ++requestSeq.current;
    setErr('');
    setLoading(true);
    setSearched(true);
    setHasMore(false);
    try {
      const rows = await searchArchive(s, PAGE_SIZE + 1, 0);
      if (seq !== requestSeq.current) return;
      setResults(rows.slice(0, PAGE_SIZE));
      setHasMore(rows.length > PAGE_SIZE);
    } catch (e) {
      if (seq === requestSeq.current) setErr(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore) return;
    setErr('');
    setLoadingMore(true);
    try {
      const rows = await searchArchive(q, PAGE_SIZE + 1, results.length);
      setResults((current) => [...current, ...rows.slice(0, PAGE_SIZE)]);
      setHasMore(rows.length > PAGE_SIZE);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setLoadingMore(false);
    }
  };

  // Search-as-you-type: the one result grid defaults to newest PinPics.
  useEffect(() => {
    const v = q.trim();
    if (v.length === 0) {
      loadNewest();
      return;
    }
    if (v.length < 2) {
      requestSeq.current += 1;
      setResults([]);
      setSearched(false);
      setHasMore(false);
      setLoading(false);
      return;
    }
    const t = setTimeout(() => { runSearch(undefined, v); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const add = async (p: Pin) => {
    setErr('');
    setBusyId(p.id);
    try {
      await addFromArchive(p, addType);
      setAdded((a) => ({ ...a, [p.id]: true }));
      setResults((rows) => rows.filter((row) => row.id !== p.id));
      toast.success(`“${p.pin_name}” added as ${addType}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Add failed.';
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const submitManual = async (input: Parameters<typeof addManual>[0]) => {
    await addManual(input);
    toast.success(`“${input.pin_name || 'Pin'}” added to the collection.`);
    setFormKey((k) => k + 1);
  };

  const modeBtn = (m: typeof mode, label: string) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition ${
      mode === m ? 'bg-sun text-[#4a3a0c]' : 'text-muted hover:text-text'
    }`;

  const pinResult = (p: Pin) => {
    const image = imageFor(p);
    return (
      <div key={p.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
          {image.src ? (
            <img
              src={image.src}
              data-full={image.full ?? undefined}
              alt=""
              className="h-full w-full object-contain p-1"
              loading="lazy"
              decoding="async"
              onError={fallbackToFullImage}
            />
          ) : (
            <span className="text-xl text-[#ddd2bf]">⬡</span>
          )}
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
    );
  };

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
              {loading ? (q.trim() ? 'Searching…' : 'Loading…') : 'Search'}
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

          {results.length > 0 && (
            <div className="mb-3 flex items-center justify-between gap-3 text-sm text-muted">
              <span>{results.length} {searched ? 'archive results' : 'newest PinPics'} loaded</span>
              {hasMore && <span>More matches available</span>}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(pinResult)}
          </div>

          {hasMore && (
            <div className="mt-5 flex justify-center">
              <button type="button" onClick={loadMore} className="btn btn-ghost" disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more results'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-2xl">
          <PinForm key={formKey} submitLabel="Add pin" onSubmit={submitManual} />
        </div>
      )}
    </div>
  );
}
