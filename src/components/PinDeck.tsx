import { useCallback, useState } from 'react';
import type { Pin } from '../lib/pins';
import PinModal from './PinModal';
import { ToastProvider } from './admin/Toast';

interface Props {
  /** Full server-rendered list shown in the grid. */
  pins: Pin[];
}

/**
 * Owns the live pin list for the modal. The grid itself is fully server-rendered,
 * so sorting/search always operate on the complete filtered set before hydration.
 */
export default function PinDeck({ pins: initialPins }: Props) {
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const updatePin = useCallback((updated: Pin) => {
    setPins((current) => {
      const next = current.map((pin) => (pin.id === updated.id ? updated : pin));
      return next;
    });
  }, []);

  return (
    <ToastProvider>
      <PinModal pins={pins} onPinUpdated={updatePin} />
    </ToastProvider>
  );
}
