import { apiRequest } from './client';
import { toQuery } from './query';

/** params: clientId, workStatus, paymentStatus, from, to, q, page, size, sort. */
export const listGigs = (params) => apiRequest(`/gigs${toQuery(params)}`);

/** The gig plus paymentCount and attachmentCount. */
export const getGig = (id) => apiRequest(`/gigs/${id}`);

export const createGig = (input) => apiRequest('/gigs', { method: 'POST', body: input });

/** 422 AGREED_BELOW_RECEIVED when the new agreed amount is below what was received. */
export const updateGig = (id, input) => apiRequest(`/gigs/${id}`, { method: 'PUT', body: input });

/** Deletes the gig with its payments and files. */
export const deleteGig = (id) => apiRequest(`/gigs/${id}`, { method: 'DELETE' });
