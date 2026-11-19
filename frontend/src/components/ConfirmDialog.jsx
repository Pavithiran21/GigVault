import { useId } from 'react';
import { Banner } from './Banner';
import { Button } from './Button';
import { Dialog } from './Dialog';

/**
 * "Delete …?" dialogs (UI-UX.md screens 17–21): the text names the effect, the safe button
 * ("Keep gig") is focused first, and the red button does it. error shows a refusal inside.
 */
export function ConfirmDialog({ title, children, keepLabel, confirmLabel, pending, error, onConfirm, onClose }) {
  const titleId = useId();
  const textId = useId();
  return (
    <Dialog role="alertdialog" labelledBy={titleId} describedBy={textId} onClose={onClose}>
      <h3 id={titleId}>{title}</h3>
      <p id={textId} className="muted mb-1.5 text-sm">
        {children}
      </p>
      {error && (
        <Banner kind="err" className="my-3">
          {error}
        </Banner>
      )}
      <div className="acts">
        <button type="button" className="btn btn-line" data-autofocus onClick={onClose}>
          {keepLabel}
        </button>
        <Button className="btn btn-red" pending={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
