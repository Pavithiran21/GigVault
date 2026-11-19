import { apiDownload, apiRequest, apiUpload } from './client';
import { toQuery } from './query';

export const listAttachments = (gigId, params) => apiRequest(`/gigs/${gigId}/attachments${toQuery(params)}`);

/** One file as multipart form data; onProgress gets 0–100. 413, 415 or 400 EMPTY_FILE when refused. */
export const uploadAttachment = (gigId, file, onProgress) => apiUpload(`/gigs/${gigId}/attachments`, file, onProgress);

/** { blob, fileName }, from the attachment's downloadUrl. */
export const downloadAttachment = (attachment) => apiDownload(attachment.downloadUrl, attachment.fileName);

export const deleteAttachment = (id) => apiRequest(`/attachments/${id}`, { method: 'DELETE' });
