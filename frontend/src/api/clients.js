import { apiRequest } from './client';
import { toQuery } from './query';

/** params: q, page, size, sort (name by default). */
export const listClients = (params) => apiRequest(`/clients${toQuery(params)}`);

export const getClient = (id) => apiRequest(`/clients/${id}`);

export const createClient = (input) => apiRequest('/clients', { method: 'POST', body: input });

/** PUT: the edit form always sends every field. */
export const updateClient = (id, input) => apiRequest(`/clients/${id}`, { method: 'PUT', body: input });

/** 409 CLIENT_IN_USE while the client has gigs. */
export const deleteClient = (id) => apiRequest(`/clients/${id}`, { method: 'DELETE' });
