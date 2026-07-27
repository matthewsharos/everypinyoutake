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
  onToggleSelected?: (pin: Pin) => void;
}

export default function PinCard({
  pin,
  index,
  eager = false,
  selectionMode = false,
  selected = false,
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

  return (
    <article
      className={`pin-card cursor-pointer ${
        selected ? 'border-magenta ring-2 ring-magenta/70 shadow-lg' : ''
      }`}
      data-pin-id={pin.id}
      data-pin-index={index}
      role="button"
      tabIndex={0}
      aria-label={selectionMode ? `${selected ? 'Deselect' : 'Select'} ${pin.pin_name}` : `View details for ${pin.pin_name}`}
      aria-pressed={selectionMode ? selected : undefined}
      onClick={
        selectionMode
          ? (event) => {
              event.stopPropagation();
              onToggleSelected?.(pin);
            }
          : undefined
      }
      onKeyDown={
        selectionMode
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onToggleSelected?.(pin);
            }
          : undefined
      }
    >
      {selectionMode && (
        <span
          aria-hidden="true"
          className={`absolute left-2.5 top-2.5 z-20 grid h-7 w-7 place-items-center rounded-full border-2 text-sm font-bold shadow-sm transition ${
            selected
              ? 'border-magenta bg-magenta text-white'
              : 'border-white bg-white/90 text-transparent ring-1 ring-black/10'
          }`}
        >
          ✓
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
