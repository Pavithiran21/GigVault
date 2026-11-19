// Avatar tiles for clients (Top clients, the client view). The tint comes from the client's id,
// so a client keeps the same colour on every screen.

const TINTS = [
  { background: '#eeecfd', color: '#5b4bd6' },
  { background: '#fef3e2', color: '#a15c07' },
  { background: '#e3f6ec', color: '#067647' },
  { background: '#fdecea', color: '#b42318' },
  { background: '#edfaf8', color: '#0b4f4a' },
];

export function clientTint(id) {
  let sum = 0;
  for (const character of String(id)) {
    sum = (sum + character.charCodeAt(0)) % 997;
  }
  return TINTS[sum % TINTS.length];
}

/** "Northwind Studio" → "NS", "Kite" → "KI", "Kavya Nair" → "KN". */
export function initials(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
