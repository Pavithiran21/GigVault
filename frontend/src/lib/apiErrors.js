// Turning API errors (api/client.js ApiError) into what the user sees.
// Messages match UI-UX.md "Validation messages" and "States".

export const TOO_MANY_ATTEMPTS = 'Too many attempts. Please wait a few minutes and try again.';
export const SOMETHING_WENT_WRONG = 'Something went wrong. Please try again.';
export const CANT_REACH = "Couldn't reach GigVault. Check your connection.";

/**
 * A 400 or 422 with field details: show each message under its field and focus the first one.
 * Returns true when at least one field got an error.
 */
export function applyFieldErrors(error, setError, fieldNames) {
  const details = (error?.details ?? []).filter((detail) => fieldNames.includes(detail.field));
  details.forEach((detail, index) => {
    setError(detail.field, { type: 'server', message: detail.message }, { shouldFocus: index === 0 });
  });
  return details.length > 0;
}

/**
 * One sentence for an error that doesn't belong to a field, shown as a form-level alert.
 * Null when the session ended (the app is already on Log in, which says why) or when the server
 * couldn't be reached (that one is a toast, see showErrorToast).
 */
export function errorMessage(error) {
  if (error?.code === 'SESSION_ENDED' || error?.status === 0) {
    return null;
  }
  if (error?.code === 'RATE_LIMITED') {
    return TOO_MANY_ATTEMPTS;
  }
  if (!error?.status || error.status >= 500) {
    return SOMETHING_WENT_WRONG;
  }
  return error.message ?? SOMETHING_WENT_WRONG;
}

/** True when the request never reached the server (a dropped connection, the backend down). */
export function isNetworkError(error) {
  return error?.status === 0;
}
