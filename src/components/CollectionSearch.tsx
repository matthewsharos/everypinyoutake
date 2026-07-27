import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deletePins as removePins } from '../lib/adminApi';
import { getCollection, type Pin, type SortKey } from '../lib/pins';
import PinCard from './PinCard';
import PinModal from './PinModal';
import { ToastProvider } from './admin/Toast';

interface Props {
  initialPins: Pin[];
  initialQuery?: string;
  initialSort: SortKey;
  totalPins: number;
  pageSize?: number;
}

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'created', label: 'Newest' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'az', label: 'A–Z' },
];

const PRELOAD_MARGIN = 1200;

function normalizeQuery(value: string) {
  return value.trim();
}

function urlFor(query: string, sort: SortKey) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (sort !== 'created') params.set('sort', sort);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

export default function CollectionSearch({
  initialPins,
  initialQuery = '',
  initialSort,
  totalPins,
  pageSize = 60,
}: Props) {
  const [inputValue, setInputValue] = useState(initialQuery);
  const [query, setQuery] = useState(normalizeQuery(initialQuery));
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialPins.length < pageSize);
  const [error, setError] = useState('');
  const [authed, setAuthed] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState('');
  const [removedCount, setRemovedCount] = useState(0);

  const requestRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const pinsRef = useRef(initialPins);
  const doneRef = useRef(done);
  const sortRef = useRef(initialSort);
  const skipInputEffectRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  pinsRef.current = pins;
  doneRef.current = done;
  sortRef.current = sort;

  const heading = query ? 'Search results' : 'The Collection';
  const resultText = useMemo(() => {
    if (!query) return `${Math.max(0, totalPins - removedCount).toLocaleString('en-US')} pins`;
    const visible = pins.length.toLocaleString('en-US');
    const suffix = !done && pins.length >= pageSize ? '+' : '';
    return `${visible}${suffix} ${pins.length === 1 && done ? 'result' : 'results'} for “${query}”`;
  }, [done, pageSize, pins.length, query, removedCount, totalPins]);

  const selectedPins = useMemo(
    () => pins.filter((pin) => selectedIds.has(pin.id)),
    [pins, selectedIds],
  );

  const replaceUrl = useCallback((nextQuery: string, nextSort: SortKey) => {
    window.history.replaceState(null, '', urlFor(nextQuery, nextSort));
  }, []);

  const runSearch = useCallback(
    async (nextQuery: string, nextSort: SortKey, { updateUrl = true } = {}) => {
      const id = requestRef.current + 1;
      requestRef.current = id;
      setSelecting(false);
      setSelectedIds(new Set());
      setConfirmingBulkDelete(false);
      setLoading(true);
      setError('');
      try {
        const { pins: nextPins } = await getCollection({
          search: nextQuery || undefined,
          sort: nextSort,
          limit: pageSize,
          offset: 0,
        });
        if (requestRef.current !== id) return;
        pinsRef.current = nextPins;
        setPins(nextPins);
        setQuery(nextQuery);
        setSort(nextSort);
        setDone(nextPins.length < pageSize);
        if (updateUrl) replaceUrl(nextQuery, nextSort);
      } catch (err) {
        if (requestRef.current !== id) return;
        setError(err instanceof Error ? err.message : 'Search failed.');
      } finally {
        if (requestRef.current === id) setLoading(false);
      }
    },
    [pageSize, replaceUrl],
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || doneRef.current) return;
    loadingMoreRef.current = true;
    setLoading(true);
    setError('');
    try {
      const current = pinsRef.current;
      const { pins: next } = await getCollection({
        search: query || undefined,
        sort,
        limit: pageSize,
        offset: current.length,
      });
      const seen = new Set(current.map((pin) => pin.id));
      const fresh = next.filter((pin) => !seen.has(pin.id));
      if (fresh.length) {
        const updated = [...current, ...fresh];
        pinsRef.current = updated;
        setPins(updated);
      }
      if (next.length < pageSize || fresh.length === 0) {
        doneRef.current = true;
        setDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more pins.');
    } finally {
      loadingMoreRef.current = false;
      setLoading(false);
    }
  }, [pageSize, query, sort]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/admin-session')
      .then((response) => response.json())
      .then((data) => mounted && setAuthed(!!data.authed))
      .catch(() => mounted && setAuthed(false));

    const onAuth = (event: Event) => {
      const nextAuthed = !!(event as CustomEvent<{ authed?: boolean }>).detail?.authed;
      setAuthed(nextAuthed);
      if (!nextAuthed) {
        setSelecting(false);
        setSelectedIds(new Set());
        setConfirmingBulkDelete(false);
      }
    };
    window.addEventListener('epyt:admin-auth', onAuth);
    return () => {
      mounted = false;
      window.removeEventListener('epyt:admin-auth', onAuth);
    };
  }, []);

  useEffect(() => {
    if (skipInputEffectRef.current) {
      skipInputEffectRef.current = false;
      return;
    }
    const nextQuery = normalizeQuery(inputValue);
    if (nextQuery.length === 1) {
      if (query) {
        const timeout = window.setTimeout(() => {
          void runSearch('', sortRef.current);
        }, 300);
        return () => window.clearTimeout(timeout);
      }
      return;
    }
    const timeout = window.setTimeout(() => {
      void runSearch(nextQuery, sortRef.current);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [inputValue, query, runSearch]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextQuery = normalizeQuery(params.get('q') ?? '');
      const sortParam = params.get('sort');
      const nextSort: SortKey = sortParam === 'updated' || sortParam === 'az' ? sortParam : 'created';
      skipInputEffectRef.current = true;
      setInputValue(nextQuery);
      void runSearch(nextQuery, nextSort, { updateUrl: false });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [runSearch]);

  useEffect(() => {
    const onScroll = () => {
      const el = sentinelRef.current;
      if (!el || doneRef.current || loadingMoreRef.current) return;
      if (el.getBoundingClientRect().top <= window.innerHeight + PRELOAD_MARGIN) void loadMore();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [loadMore]);

  const updatePin = useCallback((updated: Pin) => {
    setPins((current) => {
      const next = current.map((pin) => (pin.id === updated.id ? updated : pin));
      pinsRef.current = next;
      return next;
    });
  }, []);

  const deletePin = useCallback((deleted: Pin) => {
    setPins((current) => {
      const next = current.filter((pin) => pin.id !== deleted.id);
      pinsRef.current = next;
      return next;
    });
    setRemovedCount((count) => count + 1);
  }, []);

  const cancelSelection = () => {
    setSelecting(false);
    setSelectedIds(new Set());
    setConfirmingBulkDelete(false);
    setError('');
  };

  const toggleSelected = (pin: Pin) => {
    setBulkSuccess('');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(pin.id)) {
        next.delete(pin.id);
      } else if (next.size < 100) {
        next.add(pin.id);
      } else {
        setError('You can delete up to 100 pins at once.');
      }
      return next;
    });
  };

  const bulkDeleteSelected = async () => {
    const ids = selectedPins.map((pin) => pin.id);
    if (ids.length === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    setError('');
    try {
      const deleted = await removePins(ids);
      const deletedIds = new Set(deleted.map((pin) => pin.id));
      setPins((current) => {
        const next = current.filter((pin) => !deletedIds.has(pin.id));
        pinsRef.current = next;
        return next;
      });
      setRemovedCount((count) => count + deletedIds.size);
      setBulkSuccess(`${deletedIds.size} ${deletedIds.size === 1 ? 'pin' : 'pins'} removed from the collection.`);
      setSelecting(false);
      setSelectedIds(new Set());
      setConfirmingBulkDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the selected pins.');
      setConfirmingBulkDelete(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(normalizeQuery(inputValue), sort);
    inputRef.current?.focus();
  };

  const onSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextSort = event.target.value as SortKey;
    setSort(nextSort);
    void runSearch(normalizeQuery(inputValue), nextSort);
    inputRef.current?.focus();
  };

  const clearSearch = () => {
    skipInputEffectRef.current = true;
    setInputValue('');
    void runSearch('', sort);
    inputRef.current?.focus();
  };

  return (
    <ToastProvider>
      <form method="get" action="/" id="search" className="relative mx-auto max-w-2xl" onSubmit={onSubmit}>
        <svg
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={inputValue}
          enterKeyHint="search"
          placeholder={`Search ${totalPins.toLocaleString('en-US')} pins — name, series, origin, edition…`}
          onChange={(event) => setInputValue(event.target.value)}
          className="w-full rounded-full border border-line bg-white py-3.5 pl-12 pr-[6.5rem] text-base shadow-sm outline-none transition-colors placeholder:text-muted focus:border-sky/70"
        />
        <button
          type="submit"
          className="btn btn-primary absolute right-1.5 top-1/2 -translate-y-1/2"
          onPointerDown={(event) => event.preventDefault()}
        >
          Search
        </button>
      </form>

      <div className="mb-5 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{heading}</h1>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted">
            {resultText}
            {query && (
              <>
                {' '}
                <button type="button" onClick={clearSearch} className="text-sky hover:underline">
                  clear
                </button>
              </>
            )}
          </p>
          {authed && (
            <button
              type="button"
              onClick={() => (selecting ? cancelSelection() : setSelecting(true))}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                selecting
                  ? 'border-magenta bg-magenta/5 text-magenta'
                  : 'border-line bg-white/60 text-text hover:border-sky hover:text-sky'
              }`}
            >
              {selecting ? 'Cancel' : 'Select'}
            </button>
          )}
          <form className="flex items-center gap-2" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="sort" className="text-xs text-muted">Sort</label>
            <select
              id="sort"
              name="sort"
              value={sort}
              onChange={onSortChange}
              className="rounded-full border border-line bg-white py-1.5 pl-3 pr-8 text-sm outline-none transition-colors focus:border-sky/70"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </form>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-magenta/40 bg-magenta/5 p-4 text-sm text-magenta">
          {error}
        </div>
      )}

      {bulkSuccess && (
        <div className="mb-5 rounded-2xl border border-[#2f8f7c]/35 bg-[#2f8f7c]/10 p-4 text-sm font-semibold text-[#2f8f7c]">
          {bulkSuccess}
        </div>
      )}

      {pins.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-center">
          <p className="text-muted">{query ? `No pins match “${query}”.` : 'No pins yet.'}</p>
        </div>
      ) : (
        <>
          <div id="pin-grid" className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pins.map((pin, index) => (
              <PinCard
                key={pin.id}
                pin={pin}
                index={index}
                eager={index < 10}
                selectionMode={selecting}
                selected={selectedIds.has(pin.id)}
                onToggleSelected={toggleSelected}
              />
            ))}
          </div>

          <PinModal pins={pins} onPinUpdated={updatePin} onPinDeleted={deletePin} disabled={selecting} />

          {!done && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}
          {!done && (
            <div className="flex justify-center py-8">
              <button type="button" className="btn btn-ghost" onClick={loadMore} disabled={loading}>
                {loading ? 'Loading more pins...' : 'See More'}
              </button>
            </div>
          )}
        </>
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-4 z-[190] flex justify-center px-4">
          <div className="flex w-full max-w-md items-center gap-3 rounded-full border border-line bg-white/95 p-2 pl-5 shadow-2xl backdrop-blur">
            <span className="flex-1 text-sm font-semibold">
              {selectedIds.size} selected
            </span>
            <button type="button" onClick={cancelSelection} className="px-2 py-2 text-sm font-semibold text-muted">
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setConfirmingBulkDelete(true)}
              className="rounded-full bg-magenta px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {confirmingBulkDelete && (
        <div
          className="fixed inset-0 z-[230] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-title"
        >
          <button
            type="button"
            aria-label="Cancel bulk delete"
            onClick={() => setConfirmingBulkDelete(false)}
            className="absolute inset-0 bg-[rgba(42,36,28,0.58)] backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 id="bulk-delete-title" className="font-display text-2xl font-semibold">
              Delete {selectedIds.size} {selectedIds.size === 1 ? 'pin' : 'pins'}?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              They will be removed from the collection, but their reference records will stay in the archive.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={() => setConfirmingBulkDelete(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={bulkDeleteSelected}
                className="rounded-full bg-magenta px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
              >
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastProvider>
  );
}
