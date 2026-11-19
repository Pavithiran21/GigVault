import { apiRequest } from './client';

// Calls made before there is a session use auth: false, so a 401 (wrong password) stays a form error.

export const login = (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials, auth: false });

export const register = (input) => apiRequest('/auth/register', { method: 'POST', body: input, auth: false });

export const logout = () => apiRequest('/auth/logout', { method: 'POST', auth: false });

export const forgotPassword = (email) =>
  apiRequest('/auth/forgot-password', { method: 'POST', body: { email }, auth: false });

export const resetPassword = (token, password) =>
  apiRequest('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false });
