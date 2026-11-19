import { Logo } from '../../components/Logo';

/**
 * The tilted dark-teal "Example statement" under step 1: a static product preview, not anyone's
 * data, so it is hidden from screen readers (UI-UX.md screen 1).
 */
export function StatementCard() {
  return (
    <div className="stmt" aria-hidden="true">
      <div className="stmt-top">
        <Logo size={26} />
        <span>Example statement · Oct 2026</span>
      </div>
      <div className="stmt-big">
        ₹56,500<span>.00</span>
      </div>
      <div className="stmt-row">
        <span>Received</span>
        <b>7 payments</b>
      </div>
      <div className="stmt-row">
        <span>Still owed</span>
        <b style={{ color: '#fde68a' }}>₹73,250.00</b>
      </div>
      <div className="stmt-bar">
        <span style={{ width: '44%' }} />
      </div>
    </div>
  );
}
