import { IconCloudOff, IconCloudUpload, IconFileAlert, IconFileUpload, IconRefresh, IconTrash, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { deleteAttachment, downloadAttachment, listAttachments, uploadAttachment } from '../../api/attachments';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CANT_REACH, errorMessage, isNetworkError } from '../../lib/apiErrors';
import { timestampDayShort } from '../../lib/dates';
import { ACCEPT, fileIcon, fileProblem, formatFileSize } from '../../lib/files';
import { saveFile } from '../../lib/saveFile';
import { useToast } from '../../toast/ToastContext';

/** A file that is uploading, was refused, or failed to send. */
function UploadRow({ upload, onDismiss, onRetry }) {
  if (upload.status === 'uploading') {
    return (
      <div className="file">
        <IconFileUpload size={24} className="shrink-0 text-teal-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <b>{upload.file.name}</b>
          <div
            className="progress my-1.5"
            style={{ height: 6 }}
            role="progressbar"
            aria-valuenow={upload.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Uploading ${upload.file.name}`}
          >
            <span style={{ width: `${upload.progress}%`, background: 'var(--color-teal-500)' }} />
          </div>
          <span className="muted">Uploading… {upload.progress}%</span>
        </div>
      </div>
    );
  }
  if (upload.status === 'failed') {
    return (
      <div className="file bad-file">
        <IconCloudOff size={24} className="shrink-0 text-red" aria-hidden="true" />
        <div className="min-w-0 flex-1" role="alert">
          <b>{upload.file.name}</b>
          <span className="font-semibold text-red">Upload failed. The file wasn&apos;t saved.</span>
          <button type="button" className="btn btn-line btn-sm mt-1.5" onClick={onRetry}>
            <IconRefresh size={16} aria-hidden="true" /> Try again
          </button>
        </div>
        <button type="button" className="icon-btn sm" aria-label="Dismiss" onClick={onDismiss}>
          <IconX size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }
  return (
    <div className="file bad-file">
      <IconFileAlert size={24} className="shrink-0 text-red" aria-hidden="true" />
      <div className="min-w-0 flex-1" role="alert">
        <b>{upload.file.name}</b>
        <span className="font-semibold text-red">{upload.message}</span>
      </div>
      <button type="button" className="icon-btn sm" aria-label="Dismiss" onClick={onDismiss}>
        <IconX size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * A gig's files (UI-UX.md "Gigs screen"): PDF, DOCX, PNG or JPG up to 10 MB, stored in MongoDB
 * with the gig. A click on a name downloads the file (fetched with the token, then saved).
 */
export function Attachments({ gig }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const [uploads, setUploads] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const nextKey = useRef(1);

  const listQuery = useQuery({
    queryKey: queryKeys.gigs.attachments(gig.id),
    queryFn: () => listAttachments(gig.id, { size: 100 }),
  });
  const files = listQuery.data?.items ?? [];

  function changeUpload(key, changes) {
    setUploads((list) => list.map((upload) => (upload.key === key ? { ...upload, ...changes } : upload)));
  }

  function dropUpload(key) {
    setUploads((list) => list.filter((upload) => upload.key !== key));
  }

  async function send(key, file) {
    changeUpload(key, { status: 'uploading', progress: 0 });
    try {
      await uploadAttachment(gig.id, file, (progress) => changeUpload(key, { progress }));
      dropUpload(key);
      // The file list and the gig's attachmentCount (used by the delete-gig dialog).
      await queryClient.invalidateQueries({ queryKey: queryKeys.gigs.detail(gig.id) });
    } catch (error) {
      if (isNetworkError(error)) {
        changeUpload(key, { status: 'failed' });
      } else if (error.code === 'SESSION_ENDED') {
        dropUpload(key);
      } else {
        // 415, 413 or an empty file, in the backend's words.
        changeUpload(key, { status: 'refused', message: errorMessage(error) });
      }
    }
  }

  async function addFiles(fileList) {
    const added = [...fileList].map((file) => {
      const problem = fileProblem(file);
      const key = nextKey.current++;
      return problem
        ? { key, file, status: 'refused', message: problem }
        : { key, file, status: 'uploading', progress: 0 };
    });
    setUploads((list) => [...list, ...added]);
    // One after another, so each file's progress means something.
    for (const upload of added.filter((item) => item.status === 'uploading')) {
      await send(upload.key, upload.file);
    }
  }

  async function download(attachment) {
    try {
      const { blob, fileName } = await downloadAttachment(attachment);
      saveFile(blob, fileName);
    } catch (error) {
      if (isNetworkError(error)) {
        showError(CANT_REACH, { network: true });
      } else if (error.code !== 'SESSION_ENDED') {
        showError(errorMessage(error));
      }
    }
  }

  const remove = useMutation({
    mutationFn: (attachment) => deleteAttachment(attachment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gigs.detail(gig.id) });
      showToast({ message: 'File deleted' });
      setToDelete(null);
    },
    onError: (error) => {
      if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else {
        setDeleteError(errorMessage(error));
      }
    },
  });

  return (
    <section aria-labelledby="attachments-title">
      <h3 id="attachments-title" className="mt-5 mb-2.5 text-base">
        Attachments
      </h3>
      {(files.length > 0 || uploads.length > 0) && (
        <div className="files">
          {files.map((attachment) => {
            const { Icon, color } = fileIcon(attachment.contentType);
            return (
              <div key={attachment.id} className="file">
                <Icon size={24} className="shrink-0" style={{ color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="link file-name"
                    title={`Download ${attachment.fileName}`}
                    onClick={() => download(attachment)}
                  >
                    {attachment.fileName}
                  </button>
                  <span className="muted">
                    {formatFileSize(attachment.size)} · {timestampDayShort(attachment.createdAt, user.timeZone)}
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-btn sm danger"
                  aria-label={`Delete ${attachment.fileName}`}
                  onClick={() => {
                    setDeleteError(null);
                    setToDelete(attachment);
                  }}
                >
                  <IconTrash size={16} aria-hidden="true" />
                </button>
              </div>
            );
          })}
          {uploads.map((upload) => (
            <UploadRow
              key={upload.key}
              upload={upload}
              onDismiss={() => dropUpload(upload.key)}
              onRetry={() => send(upload.key, upload.file)}
            />
          ))}
        </div>
      )}
      <label
        className={`drop ${dragOver ? 'over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          className="sr"
          accept={ACCEPT}
          multiple
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = ''; // The same file can be picked again after a refusal.
          }}
        />
        <IconCloudUpload size={24} className="shrink-0 text-teal-700" aria-hidden="true" />
        <span>
          <b className="text-ink">Drop a file or browse.</b> {files.length === 0 && !listQuery.isPending && 'No files yet. '}
          PDF, DOCX, PNG or JPG, up to 10 MB. Only you can see attachments. Click a file&apos;s name to download it.
        </span>
      </label>
      {toDelete && (
        <ConfirmDialog
          title={`Delete ${toDelete.fileName}?`}
          keepLabel="Keep file"
          confirmLabel="Delete file"
          pending={remove.isPending}
          error={deleteError}
          onConfirm={() => remove.mutate(toDelete)}
          onClose={() => setToDelete(null)}
        >
          The file is removed from “{gig.title}”. Payments are not affected.
        </ConfirmDialog>
      )}
    </section>
  );
}
