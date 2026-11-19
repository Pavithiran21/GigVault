import { apiRequest } from './client';

/** Only the changed fields: { name?, defaultCurrency?, timeZone? }. */
export const updateProfile = (changes) => apiRequest('/me', { method: 'PATCH', body: changes });

/** Returns { user, accessToken }: the other sessions end, this one gets a new token. */
export const changePassword = (currentPassword, newPassword) =>
  apiRequest('/me/password', { method: 'POST', body: { currentPassword, newPassword } });

export const deleteAccount = (password) => apiRequest('/me', { method: 'DELETE', body: { password } });
