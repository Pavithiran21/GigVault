import { apiDownload } from './client';
import { toQuery } from './query';

/**
 * The gigs CSV with the same filters as the gigs list. Returns { blob, fileName, rowCount };
 * the backend counts the rows in X-Row-Count.
 */
export async function exportGigsCsv(filters) {
  const { blob, fileName, headers } = await apiDownload(`/exports/gigs.csv${toQuery(filters)}`, 'gigvault-gigs.csv');
  return { blob, fileName, rowCount: Number(headers.get('X-Row-Count') ?? 0) };
}
