import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Page size used for the first page; also the "is there more?" threshold. */
  pageSize: number;
  type?: CollectedType;
  search?: string;
  sort?: SortKey;
  /** When false, just render the modal, with no infinite scroll. */
  load?: boolean;
  /** When true, keep fetching pages until the server reports the full list is loaded. */
  autoLoadAll?: boolean;
}

/** Load the next page when the grid tail is within this many px of the viewport. */
const PRELOAD_MARGIN = 1200;

/**
 * Owns the live, growing pin list for a grid. The first page stays static SSR HTML;
 * this island infinitely scrolls the rest, appending cards into the same grid via a
 * portal so they flow in one CSS grid, and feeds the full list to the modal.
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
  const initialIds = useMemo(() => new Set(initialPins.map((pin) => pin.id)), [initialPins]);
  doneRef.current = done;
  pinsRef.current = pins;

  const markDone = useCallback(() => {
    doneRef.current = true;
    setDone(true);
  }, []);

  useEffect(() => {
    setGrid(document.getElementById(gridId));
  }, [gridId]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    getCollection({ type, search, sort, limit: pageSize, offset: pinsRef.current.length })
      .then(({ pins: next }) => {
        const cur = pinsRef.current;
        const seen = new Set(cur.map((p) => p.id));
        const fresh = next.filter((p) => !seen.has(p.id));

        if (fresh.length) {
          const updated = [...cur, ...fresh];
          pinsRef.current = updated;
          setPins(updated);
        }

        if (next.length < pageSize || fresh.length === 0) markDone();
      })
      .catch(() => markDone())
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
        setTimeout(() => {
          if (!doneRef.current && (autoLoadAll || nearBottomRef.current())) loadMore();
        }, 0);
      });
  }, [type, search, sort, pageSize, autoLoadAll, markDone]);

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
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [load, loadMore]);

  useEffect(() => {
    if (load && autoLoadAll && !doneRef.current) loadMore();
  }, [load, autoLoadAll, loadMore]);

  const appended = pins.filter((pin) => !initialIds.has(pin.id));
  const updatePin = useCallback((updated: Pin) => {
    setPins((current) => {
      const next = current.map((pin) => (pin.id === updated.id ? updated : pin));
      pinsRef.current = next;
      return next;
    });
  }, []);

  const deletePin = useCallback((deleted: Pin) => {
    grid?.querySelector(`[data-pin-id="${deleted.id}"]`)?.remove();
    setPins((current) => {
      const next = current.filter((pin) => pin.id !== deleted.id);
      pinsRef.current = next;
      return next;
    });
  }, [grid]);

  return (
    <>
      {grid &&
        appended.length > 0 &&
        createPortal(
          appended.map((pin, i) => <PinCard key={pin.id} pin={pin} index={initialPins.length + i} />),
          grid,
        )}

      <ToastProvider>
        <PinModal pins={pins} onPinUpdated={updatePin} onPinDeleted={deletePin} />
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
