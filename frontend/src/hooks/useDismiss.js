import { useEffect } from 'react';

/**
 * Closes a menu or popover on a click outside it (and outside its button), while active.
 * refs: the elements that count as "inside".
 */
export function useDismiss(refs, active, onClose) {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    function handlePointerDown(event) {
      const inside = refs.some((ref) => ref.current?.contains(event.target));
      if (!inside) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [refs, active, onClose]);
}
