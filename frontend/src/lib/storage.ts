/**
 * Storage helpers — UC-01-b file uploads.
 *
 * Files for a given request live under `requests/{requestId}/{filename}` in
 * Firebase Storage. The Storage path is also what gets stored in the
 * request's `attachmentPaths[]` field on the Firestore doc.
 *
 * Uploads are resumable so that a flaky connection doesn't lose progress.
 */
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from 'firebase/storage';

import { firebaseStorage } from './firebase';

export interface UploadHandle {
  /** Storage path, e.g. `requests/<uuid>/<filename>`. Persist this in Firestore. */
  path: string;
  /** A promise resolving to the public download URL once the upload completes. */
  done: Promise<{ path: string; downloadURL: string }>;
  /** Subscribe to progress (0–100). Returns an unsubscribe fn. */
  onProgress: (cb: (percent: number) => void) => () => void;
  /** Cancel the upload. */
  cancel: () => void;
  /** The underlying Firebase upload task (advanced use only). */
  task: UploadTask;
}

/** Sanitize a filename so it's safe as a Storage path segment. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function uploadAttachment(file: File, requestId: string): UploadHandle {
  const path = `requests/${requestId}/${safeName(file.name)}`;
  const storageRef = ref(firebaseStorage, path);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type || undefined,
  });

  const listeners = new Set<(p: number) => void>();
  task.on('state_changed', (snap) => {
    const pct = snap.totalBytes ? (snap.bytesTransferred / snap.totalBytes) * 100 : 0;
    listeners.forEach((cb) => cb(pct));
  });

  const done = new Promise<{ path: string; downloadURL: string }>((resolve, reject) => {
    task.then(
      async () => {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        resolve({ path, downloadURL });
      },
      (err) => reject(err),
    );
  });

  return {
    path,
    done,
    onProgress: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    cancel: () => task.cancel(),
    task,
  };
}
