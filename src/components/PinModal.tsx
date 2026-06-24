import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pin } from '../lib/pins';
import { cleanNotes } from '../lib/notes';

interface Props {
  pins: Pin[];
}

/**
 * One interactive island per grid. The grid itself stays static SSR HTML;
 * cards carry `data-pin-index` and this island opens/cycles the detail modal.
 */
export default function PinModal({ pins }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIndex(null), []);
  const go = useCallback(
    (dir: number) =>
      setIndex((i) => (i === null ? i : (i + dir + pins.length) % pins.length)),
    [pins.length],
  );

  useEffect(() => setImgIdx(0), [index]);

  // Open from clicks/keys on the static grid (event delegation).
  useEffect(() => {
    const openFrom = (el: EventTarget | null) => {
      const card = (el as Element | null)?.closest?.('[data-pin-index]') as HTMLElement | null;
      if (!card) return false;
      const i = Number(card.dataset.pinIndex);
      if (Number.isInteger(i) && i >= 0 && i < pins.length) {
        setIndex(i);
        return true;
      }
      return false;
    };
    const onClick = (e: MouseEvent) => openFrom(e.target);
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && openFrom(e.target)) e.preventDefault();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [pins.length]);

  // While open: keyboard nav, scroll lock, focus.
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [index, close, go]);

  if (index === null) return null;
  const pin = pins[index];

  const images = [pin.image_url, pin.image_url2, pin.image_url3].filter(Boolean) as string[];
  const activeImg = images[imgIdx] ?? images[0] ?? null;

  const flags = [
    pin.is_limited_edition && { cls: 'chip-le', label: 'LE' },
    pin.is_ap && { cls: 'chip-ap', label: 'AP' },
    pin.is_pp && { cls: 'chip-pp', label: 'PP' },
    pin.is_mystery && { cls: 'chip-mystery', label: 'Mystery' },
  ].filter(Boolean) as { cls: string; label: string }[];

  const typeClass =
    pin.collected_type === 'For Trade'
      ? 'type-trade'
      : pin.collected_type === 'ISO'
        ? 'type-iso'
        : 'type-collected';

  const rows: [string, string | number | null, boolean?][] = [
    ['Series', pin.series],
    ['Origin', pin.origin],
    ['Edition', pin.edition],
    ['Year', pin.year],
    ['Pin ID', pin.external_pin_id],
    ['Tags', pin.tags, true],
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={pin.pin_name}
    >
      {/* backdrop — click off to close */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 cursor-default bg-[rgba(42,36,28,0.55)] backdrop-blur-sm"
      />

      {pins.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous pin" className="modal-nav left-1 sm:left-3">‹</button>
          <button type="button" onClick={() => go(1)} aria-label="Next pin" className="modal-nav right-1 sm:right-3">›</button>
        </>
      )}

      {/* card */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl outline-none sm:flex-row"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-text shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white"
        >
          ✕
        </button>

        {/* image */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-3 bg-gradient-to-b from-white to-[#fbf5ec] p-5 sm:w-[56%] sm:p-8">
          <div className="flex h-[36vh] w-full items-center justify-center sm:h-[74vh]">
            {activeImg ? (
              <img
                src={activeImg}
                alt={pin.pin_name}
                className="max-h-full max-w-full object-contain drop-shadow-[0_12px_22px_rgba(110,95,70,0.22)]"
              />
            ) : (
              <span className="font-display text-5xl text-[#ddd2bf]">⬡</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImgIdx(i)}
                  aria-label={`Image ${i + 1}`}
                  className={`h-12 w-12 overflow-hidden rounded-lg border bg-white p-1 transition ${
                    i === imgIdx ? 'border-sky ring-2 ring-sky/30' : 'border-line hover:border-sky/50'
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* details */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`type-tag ${typeClass}`}>{pin.collected_type ?? 'Collected'}</span>
            {flags.map((f) => (
              <span key={f.label} className={`chip ${f.cls}`}>{f.label}</span>
            ))}
          </div>

          <h2 className="font-display text-2xl font-semibold leading-tight">{pin.pin_name}</h2>

          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
            {rows
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .map(([k, v, wide]) => (
                <div key={k} className={wide ? 'sm:col-span-2' : ''}>
                  <dt className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">{k}</dt>
                  <dd className="mt-0.5 text-sm">{v}</dd>
                </div>
              ))}
          </dl>

          {cleanNotes(pin.notes) && (
            <div className="mt-5">
              <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">Notes</div>
              <p className="mt-1 text-sm leading-relaxed text-text/90">{cleanNotes(pin.notes)}</p>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 pt-6">
            <span className="text-xs text-muted">{index + 1} of {pins.length}</span>
            {pin.external_url && (
              <a
                href={pin.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost text-sm"
              >
                View on PinPics ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
