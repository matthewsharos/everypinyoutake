import type { Pin } from '../lib/pins';
import { pinImage, thumbUrl } from '../lib/pins';

/**
 * Client-rendered twin of PinCard.astro, used by PinDeck to render infinitely
 * scrolled pages (page 2+). Keep the markup/classes in sync with PinCard.astro.
 * These cards are always below the fold, so they load lazily — there's no eager
 * LCP path here (that stays in the SSR PinCard.astro for the first screen).
 */
export default function PinCard({ pin, index }: { pin: Pin; index: number }) {
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
      className="pin-card cursor-pointer"
      data-pin-index={index}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${pin.pin_name}`}
    >
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
            loading="lazy"
            fetchPriority="low"
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
