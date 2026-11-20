import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deletePins as removePins } from '../lib/adminApi';
import { getCollection, type Pin, type SortKey } from '../lib/pins';
import { normalizeOrigin } from '../lib/metadata';
import PinCard from './PinCard';
import PinModal from './PinModal';
import BulkDeleteDialog from './admin/BulkDeleteDialog';
import { ToastProvider, useToast } from './admin/Toast';

interface Props {
  initialPins: Pin[];
  initialQuery?: string;
  initialSort: SortKey;
  initialOrigin?: string;
  origins: string[];
  totalPins: number;
  pageSize?: number;
}

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'created', label: 'Recently added' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'az', label: 'A–Z' },
];

const PRELOAD_MARGIN = 1200;
const MAX_BULK_DELETE = 100;

function normalizeQuery(value: string) {
  return value.trim();
}

function urlFor(query: string, sort: SortKey, origin: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (origin) params.set('origin', origin);
  if (sort !== 'created') params.set('sort', sort);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

export default function CollectionSearch(props: Props) {
  return (
    <ToastProvider>
      <CollectionSearchContent {...props} />
    </ToastProvider>
  );
}

function CollectionSearchContent({
  initialPins,
  initialQuery = '',
  initialSort,
  initialOrigin = '',
  origins,
  totalPins,
  pageSize = 60,
}: Props) {
  const toast = useToast();
  const [inputValue, setInputValue] = useState(initialQuery);
  const [query, setQuery] = useState(normalizeQuery(initialQuery));
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [origin, setOrigin] = useState(initialOrigin);
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialPins.length < pageSize);
  const [error, setError] = useState('');
  const [authed, setAuthed] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Map<number, Pin>>(() => new Map());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [removedCount, setRemovedCount] = useState(0);

  const requestRef = useRef(0);
  const searchingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const bulkDeletingRef = useRef(false);
  const paginationRevisionRef = useRef(0);
  const removedIdsRef = useRef(new Set<number>());
  const pinsRef = useRef(initialPins);
  const doneRef = useRef(done);
  const sortRef = useRef(initialSort);
  const originRef = useRef(initialOrigin);
  const skipInputEffectRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectButtonRef = useRef<HTMLButtonElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);

  pinsRef.current = pins;
  doneRef.current = done;
  sortRef.current = sort;

  const heading = query ? 'Search results' : 'The Collection';
  const resultText = useMemo(() => {
    if (!query && !origin) return `${Math.max(0, totalPins - removedCount).toLocaleString('en-US')} pins`;
    const visible = pins.length.toLocaleString('en-US');
    const suffix = !done && pins.length >= pageSize ? '+' : '';
    return `${visible}${suffix} ${pins.length === 1 && done ? 'result' : 'results'}${query ? ` for “${query}”` : ''}`;
  }, [done, pageSize, pins.length, query, origin, removedCount, totalPins]);

  const shownUnselected = selecting ? pins.filter((pin) => !selection.has(pin.id)) : [];
  const canSelectShown = shownUnselected.length > 0 && selection.size + shownUnselected.length <= MAX_BULK_DELETE;

  const replaceUrl = useCallback((nextQuery: string, nextSort: SortKey, nextOrigin: string) => {
    window.history.replaceState(null, '', urlFor(nextQuery, nextSort, nextOrigin));
  }, []);

  const runSearch = useCallback(
    async (nextQuery: string, nextSort: SortKey, { updateUrl = true, nextOrigin = originRef.current } = {}) => {
      const id = requestRef.current + 1;
      requestRef.current = id;
      searchingRef.current = true;
      setLoading(true);
      setError('');
      try {
        const { pins: nextPins } = await getCollection({
          search: nextQuery || undefined,
          sort: nextSort,
          origin: nextOrigin,
          limit: pageSize,
          offset: 0,
        });
        if (requestRef.current !== id) return;
        const availablePins = nextPins.filter((pin) => !removedIdsRef.current.has(pin.id));
        pinsRef.current = availablePins;
        setPins(availablePins);
        setQuery(nextQuery);
        setSort(nextSort);
        setOrigin(nextOrigin);
        originRef.current = nextOrigin;
        setDone(nextPins.length < pageSize);
        if (updateUrl) replaceUrl(nextQuery, nextSort, nextOrigin);
      } catch (err) {
        if (requestRef.current !== id) return;
        setError(err instanceof Error ? err.message : 'Search failed.');
      } finally {
        if (requestRef.current === id) {
          searchingRef.current = false;
          setLoading(false);
        }
      }
    },
    [pageSize, replaceUrl],
  );

  const loadMore = useCallback(async () => {
    if (searchingRef.current || loadingMoreRef.current || doneRef.current || bulkDeletingRef.current) return;
    loadingMoreRef.current = true;
    setLoading(true);
    setError('');
    const requestId = requestRef.current;
    const revision = paginationRevisionRef.current;
    const isCurrent = () => requestRef.current === requestId && paginationRevisionRef.current === revision;
    try {
      const current = pinsRef.current;
      const { pins: next } = await getCollection({
        search: query || undefined,
        origin,
        sort,
        limit: pageSize,
        offset: current.length,
      });
      if (!isCurrent()) return;
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
      if (isCurrent()) setError(err instanceof Error ? err.message : 'Could not load more pins.');
    } finally {
      loadingMoreRef.current = false;
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [pageSize, query, sort, origin]);

  useEffect(() => {
    let mounted = true;
    let authChanged = false;
    fetch('/api/admin-session')
      .then((response) => response.json())
      .then((data) => mounted && !authChanged && setAuthed(!!data.authed))
      .catch(() => mounted && !authChanged && setAuthed(false));

    const onAuth = (event: Event) => {
      authChanged = true;
      const nextAuthed = !!(event as CustomEvent<{ authed?: boolean }>).detail?.authed;
      setAuthed(nextAuthed);
      if (!nextAuthed) {
        setSelecting(false);
        setSelection(new Map());
        setConfirmingBulkDelete(false);
        setBulkError('');
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
    if (nextQuery === query) return;
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
      void runSearch(nextQuery, nextSort, { updateUrl: false, nextOrigin: normalizeOrigin(params.get('origin')) ?? '' });
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
  }, [loadMore, pins.length, bulkDeleting]);

  const updatePin = useCallback((updated: Pin) => {
    setPins((current) => {
      const next = current.map((pin) => (pin.id === updated.id ? updated : pin));
      pinsRef.current = next;
      return next;
    });
  }, []);

  const removeFromGrid = useCallback((deleted: Pin[]) => {
    const ids = new Set(deleted.map((pin) => pin.id));
    ids.forEach((id) => removedIdsRef.current.add(id));
    paginationRevisionRef.current += 1;
    setPins((current) => {
      const next = current.filter((pin) => !ids.has(pin.id));
      pinsRef.current = next;
      return next;
    });
    setRemovedCount((count) => count + ids.size);
  }, []);

  const deletePin = useCallback((deleted: Pin) => removeFromGrid([deleted]), [removeFromGrid]);

  const endSelection = () => {
    setSelecting(false);
    setSelection(new Map());
    setConfirmingBulkDelete(false);
    setBulkError('');
    requestAnimationFrame(() => selectButtonRef.current?.focus({ preventScroll: true }));
  };

  const toggleSelected = (pin: Pin) => {
    setBulkError('');
    setSelection((current) => {
      if (!current.has(pin.id) && current.size >= MAX_BULK_DELETE) return current;
      const next = new Map(current);
      if (next.has(pin.id)) next.delete(pin.id);
      else next.set(pin.id, pin);
      return next;
    });
  };

  const selectShown = () => {
    if (!canSelectShown) return;
    setSelection((current) => {
      const next = new Map(current);
      for (const pin of shownUnselected) next.set(pin.id, pin);
      return next.size <= MAX_BULK_DELETE ? next : current;
    });
  };

  const closeReview = (focusReview = true) => {
    setConfirmingBulkDelete(false);
    setBulkError('');
    requestAnimationFrame(() => {
      if (focusReview) reviewButtonRef.current?.focus({ preventScroll: true });
      else selectButtonRef.current?.focus({ preventScroll: true });
    });
  };

  const bulkDeleteSelected = async () => {
    const ids = [...selection.keys()];
    if (!authed || ids.length === 0 || bulkDeletingRef.current) return;
    bulkDeletingRef.current = true;
    paginationRevisionRef.current += 1;
    setBulkDeleting(true);
    setBulkError('');
    try {
      const deleted = await removePins(ids);
      removeFromGrid(deleted);
      toast.success(`${deleted.length} ${deleted.length === 1 ? 'pin' : 'pins'} removed from the collection.`);
      endSelection();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Could not delete the selected pins.');
    } finally {
      bulkDeletingRef.current = false;
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
    <>
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
          aria-label={`Search ${totalPins.toLocaleString('en-US')} pins by name, series, origin or edition`}
          placeholder="Search pins…"
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
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto">
          <h1 className="text-xl font-semibold sm:text-2xl">{heading}</h1>
          {authed && (
            <button
              ref={selectButtonRef}
              type="button"
              aria-pressed={selecting}
              onClick={() => (selecting ? endSelection() : setSelecting(true))}
              className="btn btn-ghost min-h-10 px-3 py-1.5 text-sm aria-pressed:border-sun aria-pressed:bg-sun/20 aria-pressed:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="4" />
                <path d="m8 12 2.5 2.5L16 9" />
              </svg>
              Select pins
            </button>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-3 sm:w-auto sm:gap-x-4">
          <p className="w-full text-sm text-muted sm:w-auto">
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
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 sm:flex-none sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor="origin" className="text-xs text-muted">Origin</label>
            <select
              id="origin"
              name="origin"
              value={origin}
              onChange={(event) => {
                const nextOrigin = event.target.value;
                originRef.current = nextOrigin;
                setOrigin(nextOrigin);
                void runSearch(normalizeQuery(inputValue), sort, { nextOrigin });
              }}
              className="w-full min-w-0 sm:w-[10.5rem] rounded-full border border-line bg-white py-1.5 pl-3 pr-8 text-sm outline-none transition-colors focus:border-sky/70"
            >
              <option value="">All origins</option>
              {origins.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <form className="flex min-w-0 flex-1 flex-col items-start gap-1.5 sm:flex-none sm:flex-row sm:items-center sm:gap-2" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="sort" className="text-xs text-muted">Sort</label>
            <select
              id="sort"
              name="sort"
              value={sort}
              onChange={onSortChange}
              className="w-full min-w-0 sm:w-[10.5rem] rounded-full border border-line bg-white py-1.5 pl-3 pr-8 text-sm outline-none transition-colors focus:border-sky/70"
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

      {selecting && (
        <div className="mb-3 flex min-h-10 flex-wrap items-center justify-between gap-x-3 border-t border-line pt-2">
          <p className="text-sm text-text/75">
            {selection.size === MAX_BULK_DELETE ? '100-pin limit reached.' : 'Choose pins from the grid.'}
          </p>
          {canSelectShown && (
            <button type="button" onClick={selectShown} className="min-h-10 text-sm font-semibold text-text underline-offset-4 hover:underline">
              Select shown ({shownUnselected.length})
            </button>
          )}
        </div>
      )}

      {selecting && (
        <div data-pin-selection className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] flex justify-center px-3 sm:px-4">
          <div className="pointer-events-auto flex w-full max-w-lg flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-2xl border border-line bg-white/95 p-2 pl-3 shadow-xl backdrop-blur motion-safe:animate-toast-in sm:pl-5">
            <output className="shrink-0 text-sm font-bold tabular-nums">{selection.size} selected</output>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelection(new Map());
                  doneButtonRef.current?.focus({ preventScroll: true });
                }}
                disabled={selection.size === 0}
                className="min-h-11 rounded-full px-2 text-sm font-semibold enabled:hover:bg-ink-2 disabled:opacity-50"
              >
                Clear
              </button>
              <button ref={doneButtonRef} type="button" onClick={endSelection} className="min-h-11 rounded-full px-2 text-sm font-semibold hover:bg-ink-2">
                Done
              </button>
              <button
                ref={reviewButtonRef}
                type="button"
                disabled={selection.size === 0}
                onClick={() => setConfirmingBulkDelete(true)}
                className="btn btn-ghost min-h-11 border-[#8c4027]/25 px-3 text-sm text-[#8c4027] enabled:hover:border-[#8c4027] enabled:hover:text-[#8c4027] disabled:opacity-50 sm:px-4"
              >
                Review delete
              </button>
            </div>
          </div>
        </div>
      )}

      {pins.length === 0 ? (
        done && <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-center">
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
                selected={selection.has(pin.id)}
                selectionFull={selection.size === MAX_BULK_DELETE}
                onToggleSelected={toggleSelected}
              />
            ))}
          </div>

          <PinModal pins={pins} onPinUpdated={updatePin} onPinDeleted={deletePin} disabled={selecting} />
        </>
      )}

      {!done && (
        <>
          <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
          <div className="flex justify-center py-8">
            <button type="button" className="btn btn-ghost" onClick={loadMore} disabled={loading || bulkDeleting}>
              {loading ? 'Loading more pins...' : 'See More'}
            </button>
          </div>
        </>
      )}

      {confirmingBulkDelete && (
        <BulkDeleteDialog
          pins={[...selection.values()]}
          busy={bulkDeleting}
          error={bulkError}
          onCancel={() => closeReview()}
          onRemove={(pin) => {
            toggleSelected(pin);
            if (selection.size === 1) closeReview(false);
          }}
          onConfirm={bulkDeleteSelected}
        />
      )}
    </>
  );
}
