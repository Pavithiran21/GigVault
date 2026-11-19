import { IconFile, IconFileTypeDocx, IconFileTypeJpg, IconFileTypePdf, IconFileTypePng } from '@tabler/icons-react';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.png', '.jpg', '.jpeg'];

/** What the file picker offers. */
export const ACCEPT = '.pdf,.docx,.png,.jpg,.jpeg';

/**
 * A quick check before uploading, so a 9 MB .psd isn't sent just to be refused. The backend still
 * decides from the file's first bytes (a renamed .exe passes this check and is refused there).
 * Returns the UI-UX.md message, or null.
 */
export function fileProblem(file) {
  const name = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return 'File type not allowed. Use PDF, DOCX, PNG or JPG.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'File is larger than 10 MB.';
  }
  if (file.size === 0) {
    return 'The file is empty.';
  }
  return null;
}

/** "412 KB", "2.4 MB". */
export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The icon and colour for an attachment, from the type the backend detected. */
export function fileIcon(contentType) {
  if (contentType === 'application/pdf') return { Icon: IconFileTypePdf, color: 'var(--color-red)' };
  if (contentType?.includes('wordprocessingml')) return { Icon: IconFileTypeDocx, color: 'var(--color-violet)' };
  if (contentType === 'image/png') return { Icon: IconFileTypePng, color: 'var(--color-teal-700)' };
  if (contentType === 'image/jpeg') return { Icon: IconFileTypeJpg, color: 'var(--color-teal-700)' };
  return { Icon: IconFile, color: 'var(--color-muted)' };
}
