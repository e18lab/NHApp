export type DownloadProgressSnapshot = {
  active: boolean;
  bookId: number | null;
  title: string | null;
  cover: string | null;
  progress: number; // 0..1
  lastFinishedAt: number;
  lastFinishedBookId: number | null;
};

let snapshot: DownloadProgressSnapshot = {
  active: false,
  bookId: null,
  title: null,
  cover: null,
  progress: 0,
  lastFinishedAt: 0,
  lastFinishedBookId: null,
};

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function setDownloadProgress(next: Partial<DownloadProgressSnapshot>) {
  snapshot = { ...snapshot, ...next };
  notify();
}

export function clearDownloadProgress() {
  snapshot = {
    ...snapshot,
    active: false,
    bookId: null,
    title: null,
    cover: null,
    progress: 0,
  };
  notify();
}

export function markDownloadFinished(bookId: number | null) {
  snapshot = {
    ...snapshot,
    lastFinishedAt: Date.now(),
    lastFinishedBookId: typeof bookId === "number" ? bookId : null,
  };
  notify();
}

export function subscribeDownloadProgress(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDownloadProgressSnapshot(): DownloadProgressSnapshot {
  return snapshot;
}

