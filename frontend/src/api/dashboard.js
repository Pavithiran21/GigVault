import { apiRequest } from './client';
import { toQuery } from './query';

/** params: period = month | year | custom, and from/to for custom. */
export const getDashboard = (params) => apiRequest(`/dashboard${toQuery(params)}`);
