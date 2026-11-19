import { IconFileSpreadsheet } from '@tabler/icons-react';
import { useState } from 'react';
import { exportGigsCsv } from '../../api/exports';
import { CANT_REACH, errorMessage, isNetworkError } from '../../lib/apiErrors';
import { plural } from '../../lib/enums';
import { saveFile } from '../../lib/saveFile';
import { useToast } from '../../toast/ToastContext';

/**
 * Export CSV (owner's choice, 1 Nov 2026): the file is saved at once, and the toast
 * "CSV ready: 23 gigs · Download" confirms it; its Download saves the same file again, in case
 * the browser blocked the first save. filters are the gigs-list filters (or the period's dates).
 */
export function useCsvExport() {
  const { showToast, showError } = useToast();
  const [pending, setPending] = useState(false);

  async function exportCsv(filters) {
    setPending(true);
    try {
      const { blob, fileName, rowCount } = await exportGigsCsv(filters);
      saveFile(blob, fileName);
      showToast({
        message: `CSV ready: ${plural(rowCount, 'gig')}`,
        icon: IconFileSpreadsheet,
        action: { label: 'Download', onClick: () => saveFile(blob, fileName) },
      });
    } catch (error) {
      if (isNetworkError(error)) {
        showError(CANT_REACH, { network: true });
      } else if (error.code !== 'SESSION_ENDED') {
        showError(errorMessage(error));
      }
    } finally {
      setPending(false);
    }
  }

  return { exportCsv, pending };
}
