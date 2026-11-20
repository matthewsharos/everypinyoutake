import type { Pin } from '../lib/pins';
import { pinImage, thumbUrl } from '../lib/pins';

/**
 * Client-rendered twin of PinCard.astro, used by PinDeck to render infinitely
 * scrolled pages (page 2+). Keep the markup/classes in sync with PinCard.astro.
 * Appended cards load lazily. Client-owned grids can opt the first visible
 * cards into eager loading so the LCP path stays fast.
 */
interface Props {
  pin: Pin;
  index: number;
  eager?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  selectionFull?: boolean;
  onToggleSelected?: (pin: Pin) => void;
}

export default function PinCard({
  pin,
  index,
  eager = false,
  selectionMode = false,
  selected = false,
  selectionFull = false,
  onToggleSelected,
}: Props) {
  const img = pinImage(pin);
  const thumb = thumbUrl(img);

  const flags = [
    pin.is_limited_edition && { cls: 'chip-le', label: 'LE' },
    pin.is_ap && { cls: 'chip-ap', label: 'AP' },
    pin.is_pp && { cls: 'chip-pp', label: 'PP' },
    pin.is_mystery && { cls: 'chip-mystery', label: 'Mystery' },
  ].filter(Boolean) as { cls: string; label: string }[];

  const meta = [pin.origin, pin.year ? String(pin.year) : null].filter(Boolean).join(' · ');
  const selectionDisabled = selectionMode && selectionFull && !selected;

  return (
    <article
      className="pin-card cursor-pointer aria-disabled:cursor-default"
      data-pin-id={pin.id}
      data-pin-index={index}
      role={selectionMode ? 'checkbox' : 'button'}
      tabIndex={0}
      aria-label={selectionMode ? pin.pin_name : `View details for ${pin.pin_name}`}
      aria-checked={selectionMode ? selected : undefined}
      aria-disabled={selectionDisabled || undefined}
      onClick={
        selectionMode
          ? (event) => {
              event.stopPropagation();
              if (!selectionDisabled) onToggleSelected?.(pin);
            }
          : undefined
      }
      onKeyDown={
        selectionMode
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              if (!event.repeat && !selectionDisabled) onToggleSelected?.(pin);
            }
          : undefined
      }
    >
      {selectionMode && (
        <span
          aria-hidden="true"
          className={`absolute left-2.5 top-2.5 z-20 grid size-7 place-items-center rounded-full border shadow-sm motion-safe:transition-colors ${
            selected
              ? 'border-sun bg-sun text-[#4a3a0c]'
              : 'border-text/25 bg-white/95 text-transparent'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 4.5 4.5L19 7" />
          </svg>
        </span>
      )}
      <div className="pin-shot">
        {pin.edition && (
          <span className="absolute right-2.5 top-2.5 z-10 rounded-md bg-white/85 px-1.5 py-0.5 text-[0.66rem] font-bold text-text shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
            {pin.edition}
          </span>
        )}
        {img ? (
          <img
            src={thumb ?? img}
            alt={pin.pin_name}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'low'}
            decoding="async"
            // Fall back to the full-size original if the thumbnail 404s.
            onError={(e) => {
              const el = e.currentTarget;
              if (img && el.src !== img) el.src = img;
            }}
          />
        ) : (
          <span className="pin-shot--empty" aria-hidden="true">⬡</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-2 font-body text-sm font-semibold leading-snug">{pin.pin_name}</h3>
        {pin.series && <p className="line-clamp-1 text-xs text-muted">{pin.series}</p>}

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {meta && <p className="text-[0.7rem] text-muted">{meta}</p>}
          {flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {flags.map((f) => (
                <span key={f.label} className={`chip ${f.cls}`}>{f.label}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
