import { apiRequest } from './client';
import { toQuery } from './query';

/** A gig's payments; params: page, size, sort. */
export const listGigPayments = (gigId, params) => apiRequest(`/gigs/${gigId}/payments${toQuery(params)}`);

/** Returns { payment, gig }: the gig with its new outstanding amount. 422 PAYMENT_EXCEEDS_OUTSTANDING. */
export const recordPayment = (gigId, input) => apiRequest(`/gigs/${gigId}/payments`, { method: 'POST', body: input });

/** Every payment; params: clientId, from, to, page, size, sort. */
export const listPayments = (params) => apiRequest(`/payments${toQuery(params)}`);

export const deletePayment = (id) => apiRequest(`/payments/${id}`, { method: 'DELETE' });
