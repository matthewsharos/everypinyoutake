import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCollection, type CollectedType, type Pin, type SortKey } from '../lib/pins';
import PinCard from './PinCard';
import PinModal from './PinModal';
import { ToastProvider } from './admin/Toast';

interface Props {
  /** First page, server-rendered as static cards already in the grid (indices 0..n-1). */
  initialPins: Pin[];
  /** id of the SSR grid container to portal subsequent pages into. */
  gridId: string;
  /** Page size (the limit used for the first page); also the "is there more?" threshold. */
  pageSize: number;
  type?: CollectedType;
  search?: string;
  sort?: SortKey;
  /** When false, just render the modal — no infinite scroll. */
  load?: boolean;
  /** When true, keep fetching pages until the server reports the full list is loaded. */
  autoLoadAll?: boolean;
}

/** Load the next page when the grid's tail is within this many px of the viewport. */
const PRELOAD_MARGIN = 1200;

/**
 * Owns the live, growing pin list for a grid. The first page stays static SSR HTML;
 * this island infinitely scrolls the rest, appending cards into the same grid (via a
 * portal) so they flow in one CSS grid, and feeds the full list to the modal so every
 * loaded pin stays clickable and navigable.
 *
 * Loading is scroll/resize-driven (not IntersectionObserver): on a tall page the
 * portaled cards land *above* the sentinel, so IO edge-triggering proved unreliable
 * once the page grew. A throttled position check that self-chains until the viewport
 * is filled loads the whole collection deterministically.
 */
export default function PinDeck({
  initialPins,
  gridId,
  pageSize,
  type,
  search,
  sort,
  load = true,
  autoLoadAll = false,
}: Props) {
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [grid, setGrid] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!load || initialPins.length < pageSize);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const doneRef = useRef(done);
  const pinsRef = useRef(pins);
  const nearBottomRef = useRef<() => boolean>(() => false);
  doneRef.current = done;
  pinsRef.current = pins;

  // Locate the SSR grid so portaled cards land in the same CSS grid as page one.
  useEffect(() => {
    setGrid(document.getElementById(gridId));
  }, [gridId]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    getCollection({ type, search, sort, limit: pageSize, offset: pinsRef.current.length })
      .then(({ pins: next }) => {
        // Dedup against the synchronously-tracked list (pinsRef), not inside the
        // setPins updater — the updater runs async, so reading its result here would
        // be stale. Advance pinsRef immediately so the offset is correct before the
        // next chained load, even if React hasn't re-rendered yet.
        const cur = pinsRef.current;
        const seen = new Set(cur.map((p) => p.id));
        const fresh = next.filter((p) => !seen.has(p.id));
        if (fresh.length) {
          const updated = [...cur, ...fresh];
          pinsRef.current = updated;
          setPins(updated);
        }
        // Stop when the server returns a short page, or (defensively) a full page that
        // added nothing new — the only ways the collection can be exhausted.
        if (next.length < pageSize || fresh.length === 0) setDone(true);
      })
      .catch(() => setDone(true)) // stop hammering on error
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
        // Keep filling until the tail is pushed out of the preload zone (or done).
        // Search pages opt into loading every matching page, so result lists are
        // complete even when the user does not scroll to the bottom.
        setTimeout(() => {
          if (!doneRef.current && (autoLoadAll || nearBottomRef.current())) loadMore();
        }, 0);
      });
  }, [type, search, sort, pageSize, autoLoadAll]);

  // Scroll/resize-driven loading.
  useEffect(() => {
    if (!load) return;
    const nearBottom = () => {
      const el = sentinelRef.current;
      if (!el) return false;
      return el.getBoundingClientRect().top <= window.innerHeight + PRELOAD_MARGIN;
    };
    nearBottomRef.current = nearBottom;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      setTimeout(() => {
        ticking = false;
        if (nearBottom()) loadMore();
      }, 100);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll(); // fill the first screen if the initial page is short
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [load, loadMore]);

  useEffect(() => {
    if (load && autoLoadAll && !doneRef.current) loadMore();
  }, [load, autoLoadAll, loadMore]);

  const appended = pins.slice(initialPins.length);
  const updatePin = useCallback((updated: Pin) => {
    setPins((current) => {
      const next = current.map((pin) => (pin.id === updated.id ? updated : pin));
      pinsRef.current = next;
      return next;
    });
  }, []);

  return (
    <>
      {grid &&
        appended.length > 0 &&
        createPortal(
          appended.map((pin, i) => <PinCard key={pin.id} pin={pin} index={initialPins.length + i} />),
          grid,
        )}

      <ToastProvider>
        <PinModal pins={pins} onPinUpdated={updatePin} />
      </ToastProvider>

      {!done && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}
      {load && !done && (
        <div className="flex justify-center py-8">
          <button type="button" className="btn btn-ghost" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading more pins...' : 'See More'}
          </button>
        </div>
      )}
    </>
  );
}
