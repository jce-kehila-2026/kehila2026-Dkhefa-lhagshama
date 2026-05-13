/**
 * Storage helpers — UC-01-b file uploads.
 *
 * Files for a given request live under `requests/{requestId}/{filename}`.
 * The browser uploads to the backend, which stores the file in Firebase
 * Storage using the Admin SDK and returns the Storage path for Firestore.
 */
import { getIdToken } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export interface UploadHandle {
  /** Storage path, e.g. `requests/<uuid>/<filename>`. Persist this in Firestore. */
  path: string;
  /** A promise resolving to the public download URL once the upload completes. */
  done: Promise<{ path: string; downloadURL: string }>;
  /** Subscribe to progress (0–100). Returns an unsubscribe fn. */
  onProgress: (cb: (percent: number) => void) => () => void;
  /** Cancel the upload. */
  cancel: () => void;
  /** The underlying XMLHttpRequest (advanced use only). */
  task: XMLHttpRequest;
}

/** Sanitize a filename so it's safe as a Storage path segment. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function uploadAttachment(file: File, requestId: string): UploadHandle {
  const path = `requests/${requestId}/${safeName(file.name)}`;
  const listeners = new Set<(p: number) => void>();
  const xhr = new XMLHttpRequest();
  let resolveDone: (value: { path: string; downloadURL: string }) => void = () => {};
  let rejectDone: (reason?: unknown) => void = () => {};

  const done = new Promise<{ path: string; downloadURL: string }>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = event.total ? (event.loaded / event.total) * 100 : 0;
      listeners.forEach((cb) => cb(pct));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`upload_failed: ${xhr.status} ${xhr.responseText || xhr.statusText || ''}`));
        return;
      }

      try {
        const body = JSON.parse(xhr.responseText) as { path?: string; downloadURL?: string };
        resolve({ path: body.path || path, downloadURL: body.downloadURL || '' });
      } catch {
        resolve({ path, downloadURL: '' });
      }
    };

    xhr.onerror = () => reject(new Error('upload_failed: network_error'));
    xhr.onabort = () => reject(new Error('upload_failed: aborted'));
  });

  void (async () => {
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        rejectDone(new Error('missing_auth_token'));
        return;
      }

      const url = `${API_BASE}/api/uploads/requests/${encodeURIComponent(requestId)}?filename=${encodeURIComponent(safeName(file.name))}`;
      xhr.open('POST', url, true);
      xhr.responseType = 'text';
      xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    } catch (err) {
      rejectDone(err);
    }
  })();

  return {
    path,
    done,
    onProgress: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    cancel: () => xhr.abort(),
    task: xhr,
  };
}
