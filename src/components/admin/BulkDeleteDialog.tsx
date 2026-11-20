import { useEffect, useRef } from 'react';
import { pinImage, thumbUrl, type Pin } from '../../lib/pins';

interface Props {
  pins: Pin[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onRemove: (pin: Pin) => void;
  onConfirm: () => void;
}

export default function BulkDeleteDialog({ pins, busy, error, onCancel, onRemove, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const count = pins.length;
  const label = `${count} ${count === 1 ? 'pin' : 'pins'}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => dialog?.close();
  }, []);

  const cancel = () => {
    dialogRef.current?.close();
    onCancel();
  };

  return (
    <dialog
      ref={dialogRef}
      data-bulk-delete
      aria-labelledby="bulk-delete-title"
      aria-describedby="bulk-delete-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) cancel();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-line bg-white text-text shadow-2xl backdrop:bg-text/45 open:flex motion-safe:animate-toast-in"
    >
      <header className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
        <h2 id="bulk-delete-title" className="text-2xl font-semibold">Delete {label}?</h2>
        <p id="bulk-delete-description" className="mt-2 text-sm text-text/75">
          The selected pins will be removed from the collection.
        </p>
      </header>

      <ul className="min-h-0 divide-y divide-line overflow-y-auto overscroll-contain border-y border-line bg-surface-2 px-5 sm:px-6">
        {pins.map((pin) => {
          const image = thumbUrl(pinImage(pin));
          return (
            <li key={pin.id} className="flex items-center gap-3 py-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white p-0.5" aria-hidden="true">
                {image && <img src={image} alt="" loading="lazy" className="size-full object-contain" />}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold break-words">{pin.pin_name}</span>
              <button
                type="button"
                onClick={() => {
                  if (count === 1) dialogRef.current?.close();
                  onRemove(pin);
                  if (count > 1) cancelRef.current?.focus();
                }}
                disabled={busy}
                aria-label={`Deselect ${pin.pin_name}`}
                className="grid size-11 shrink-0 place-items-center rounded-full text-lg text-text/65 hover:bg-ink-2 hover:text-text disabled:opacity-50"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="px-5 py-4 sm:px-6">
        {error && <p role="alert" className="mb-3 text-sm text-[#8c4027]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button ref={cancelRef} type="button" className="btn btn-ghost disabled:opacity-50" onClick={cancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : `Delete ${label}`}
          </button>
        </div>
      </footer>
    </dialog>
  );
}
