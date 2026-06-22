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

// starts an authed multipart-less POST upload of `file` to the backend uploads route.
// returns synchronously with an UploadHandle so the caller can wire progress/cancel
// before the async auth-token fetch + xhr.send actually fires (see the IIFE below).
export function uploadAttachment(file: File, requestId: string): UploadHandle {
  // The caller (UploadArea) already passes a File whose name was run through the
  // shared `sanitizeFilename` (utils/sanitizeFilename.ts), and the backend
  // sanitizes the `?filename=` param once more as the single source of truth for
  // the stored name. We do NOT re-sanitize here — a third client-side sanitizer
  // double-prefixed uploads (UI name != stored name). Send the name as-is and
  // treat this `path` as optimistic; the real path comes back in the response.
  const path = `requests/${requestId}/${file.name}`;
  const listeners = new Set<(p: number) => void>();
  const xhr = new XMLHttpRequest();
  // captured out of the Promise executor so the deferred IIFE can reject `done`
  // for failures that happen before the xhr is even opened (e.g. missing token).
  let rejectDone: (reason?: unknown) => void = () => {};

  const done = new Promise<{ path: string; downloadURL: string }>((resolve, reject) => {
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

      // prefer the server-authoritative path/url; fall back to the optimistic path
      // if the body is missing fields or isn't JSON (2xx with no/odd body still succeeds).
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

  // deferred so the handle is returned first; fetches the auth token then opens+sends
  // the request. `void` because we drive completion through `done`, not this promise.
  void (async () => {
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        rejectDone(new Error('missing_auth_token'));
        return;
      }

      const url = `${API_BASE}/api/uploads/requests/${encodeURIComponent(requestId)}?filename=${encodeURIComponent(file.name)}`;
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
