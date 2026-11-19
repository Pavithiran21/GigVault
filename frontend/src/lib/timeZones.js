// The Profile time-zone list: every IANA zone the browser knows, labelled with its current
// offset ("Asia/Kolkata (GMT+05:30)"), so the backend's own list (tzdata) accepts each one.

function offsetLabel(timeZone, now) {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(now)
      .find((part) => part.type === 'timeZoneName')?.value;
    // "GMT" alone means +00:00.
    return name === 'GMT' ? 'GMT+00:00' : name;
  } catch {
    return '';
  }
}

/** [{ value: 'Asia/Kolkata', label: 'Asia/Kolkata (GMT+05:30)' }, ...], with the current zone always in it. */
export function timeZoneOptions(currentZone) {
  const zones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [];
  const list = zones.includes(currentZone) || !currentZone ? zones : [currentZone, ...zones];
  const now = new Date();
  return list.map((zone) => {
    const offset = offsetLabel(zone, now);
    return { value: zone, label: offset ? `${zone} (${offset})` : zone };
  });
}

/** The device's time zone, sent at sign-up (UI-UX.md: "the time zone is taken from the device"). */
export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
