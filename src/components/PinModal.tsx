import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Pin } from '../lib/pins';
import { thumbUrl } from '../lib/pins';
import { cleanNotes } from '../lib/notes';
import { updatePin as savePin, uploadPinImage, type PinInput } from '../lib/adminApi';
import PinForm from './admin/PinForm';
import { useToast } from './admin/Toast';

interface Props {
  pins: Pin[];
  onPinUpdated?: (pin: Pin) => void;
}

type ImageSlot = 'image_url' | 'image_url2' | 'image_url3';

const imageSlots: ImageSlot[] = ['image_url', 'image_url2', 'image_url3'];

/**
 * One interactive island per grid. The grid itself stays static SSR HTML;
 * cards carry `data-pin-index` and this island opens/cycles the detail modal.
 */
export default function PinModal({ pins, onPinUpdated }: Props) {
  const toast = useToast();
  const [index, setIndex] = useState<number | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<ImageSlot | null>(null);
  const [editedPins, setEditedPins] = useState<Record<number, Pin>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<ImageSlot>('image_url');

  const visiblePins = useMemo(
    () => pins.map((pin) => editedPins[pin.id] ?? pin),
    [pins, editedPins],
  );

  const close = useCallback(() => {
    setIndex(null);
    setEditing(false);
  }, []);
  const go = useCallback(
    (dir: number) =>
      setIndex((i) => (i === null ? i : (i + dir + visiblePins.length) % visiblePins.length)),
    [visiblePins.length],
  );

  useEffect(() => {
    let mounted = true;
    fetch('/api/admin-session')
      .then((r) => r.json())
      .then((d) => mounted && setAuthed(!!d.authed))
      .catch(() => mounted && setAuthed(false));
    const onAuth = (event: Event) => {
      const detail = (event as CustomEvent<{ authed?: boolean }>).detail;
      setAuthed(!!detail?.authed);
    };
    window.addEventListener('epyt:admin-auth', onAuth);
    return () => {
      mounted = false;
      window.removeEventListener('epyt:admin-auth', onAuth);
    };
  }, []);

  useEffect(() => {
    setImgIdx(0);
    setZoomed(false);
    setEditing(false);
  }, [index]);

  // Open from clicks/keys on the static grid (event delegation).
  useEffect(() => {
    const openFrom = (el: EventTarget | null) => {
      const card = (el as Element | null)?.closest?.('[data-pin-index]') as HTMLElement | null;
      if (!card) return false;
      const i = Number(card.dataset.pinIndex);
      if (Number.isInteger(i) && i >= 0 && i < visiblePins.length) {
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
  }, [visiblePins.length]);

  // While open: keyboard nav, scroll lock, focus.
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (zoomed) {
        if (e.key === 'Escape') setZoomed(false);
        return;
      }
      if (e.key === 'Escape') close();
      else if (!editing && e.key === 'ArrowRight') go(1);
      else if (!editing && e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [index, close, go, zoomed, editing]);

  if (index === null) return null;
  const pin = visiblePins[index];

  const imageEntries = imageSlots
    .map((slot) => ({ slot, src: pin[slot] as string | null }))
    .filter((entry): entry is { slot: ImageSlot; src: string } => Boolean(entry.src));
  const activeEntry = imageEntries[imgIdx] ?? imageEntries[0] ?? null;
  const activeImg = activeEntry?.src ?? null;

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

  const applyUpdatedPin = (updated: Pin) => {
    setEditedPins((current) => ({ ...current, [updated.id]: updated }));
    onPinUpdated?.(updated);
  };

  const saveEdit = async (input: PinInput) => {
    const updated = await savePin(pin.id, input);
    applyUpdatedPin(updated);
    setEditing(false);
    toast.success(`"${updated.pin_name}" saved.`);
  };

  const openReplace = (slot: ImageSlot) => {
    pendingSlotRef.current = slot;
    fileRef.current?.click();
  };

  const replaceImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const slot = pendingSlotRef.current;
    setUploadingSlot(slot);
    try {
      const url = await uploadPinImage(file);
      const updated = await savePin(pin.id, { [slot]: url } as Partial<PinInput>);
      applyUpdatedPin(updated);
      const nextIndex = imageSlots.filter((s) => s === slot || Boolean(updated[s])).findIndex((s) => s === slot);
      if (nextIndex >= 0) setImgIdx(nextIndex);
      toast.success('Photo updated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Photo upload failed.');
    } finally {
      setUploadingSlot(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={pin.pin_name}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 cursor-default bg-[rgba(42,36,28,0.55)] backdrop-blur-sm"
      />

      {visiblePins.length > 1 && !editing && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous pin" className="modal-nav left-1 sm:left-3">‹</button>
          <button type="button" onClick={() => go(1)} aria-label="Next pin" className="modal-nav right-1 sm:right-3">›</button>
        </>
      )}

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl outline-none sm:flex-row"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-text shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white"
        >
          X
        </button>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={replaceImage} />

        <div className="flex shrink-0 flex-col items-center justify-center gap-3 bg-gradient-to-b from-white to-[#f7f7f9] p-5 sm:w-[52%] sm:p-8">
          <div className="relative flex h-[36vh] w-full items-center justify-center sm:h-[74vh]">
            {activeImg ? (
              <>
                <button
                  type="button"
                  onClick={() => (authed ? openReplace(activeEntry?.slot ?? 'image_url') : setZoomed(true))}
                  className="group flex h-full w-full items-center justify-center"
                  aria-label={authed ? 'Replace selected photo' : 'View full size'}
                >
                  <img
                    src={activeImg}
                    alt={pin.pin_name}
                    className="max-h-full max-w-full object-contain drop-shadow-[0_12px_22px_rgba(110,95,70,0.22)] transition group-hover:scale-[1.015]"
                  />
                  {authed && (
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-text shadow ring-1 ring-black/5">
                      {uploadingSlot ? 'Uploading...' : 'Replace photo'}
                    </span>
                  )}
                </button>
                {!authed && (
                  <button
                    type="button"
                    onClick={() => setZoomed(true)}
                    aria-label="View full size"
                    className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-text shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                    </svg>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                disabled={!authed || !!uploadingSlot}
                onClick={() => openReplace('image_url')}
                className="grid h-full w-full place-items-center rounded-2xl border border-dashed border-line text-center disabled:cursor-default"
              >
                <span className="font-display text-5xl text-[#ddd2bf]">⬡</span>
                {authed && <span className="text-sm font-semibold text-muted">Upload photo</span>}
              </button>
            )}
          </div>
          {imageEntries.length > 1 && (
            <div className="flex gap-2">
              {imageEntries.map(({ src }, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImgIdx(i)}
                  aria-label={`Image ${i + 1}`}
                  className={`h-12 w-12 overflow-hidden rounded-lg border bg-white p-1 transition ${
                    i === imgIdx ? 'border-sky ring-2 ring-sky/30' : 'border-line hover:border-sky/50'
                  }`}
                >
                  <img src={thumbUrl(src) ?? src} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`type-tag ${typeClass}`}>{pin.collected_type ?? 'Collected'}</span>
            {flags.map((f) => (
              <span key={f.label} className={`chip ${f.cls}`}>{f.label}</span>
            ))}
            {authed && (
              <button
                type="button"
                onClick={() => setEditing((value) => !value)}
                className="ml-auto rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted transition hover:border-sky hover:text-sky"
              >
                {editing ? 'Done' : 'Edit'}
              </button>
            )}
          </div>

          {editing ? (
            <PinForm key={pin.id} initial={pin} submitLabel="Save changes" onSubmit={saveEdit} />
          ) : (
            <>
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
            </>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 pt-6">
            <span className="text-xs text-muted">{index + 1} of {visiblePins.length}</span>
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

      {zoomed && activeImg && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(20,18,14,0.93)] p-4"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Full size image"
        >
          <img src={activeImg} alt={pin.pin_name} className="max-h-[96vh] max-w-[96vw] object-contain" />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="Close full size"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-text shadow ring-1 ring-black/10"
          >
            X
          </button>
        </div>
      )}
    </div>
  );
}
