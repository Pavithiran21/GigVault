import { clientTint, initials } from '../lib/clientTint';

/** A client's initials on a tinted tile; the tint follows the client's id. */
export function ClientAvatar({ id, name }) {
  return (
    <span className="av" style={clientTint(id)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
