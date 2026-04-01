export type PendingWhatsNewUpdate = {
  versionName: string;
  notes: string;
  apkUrl: string;
};

let pending: PendingWhatsNewUpdate | null = null;

export function setPendingWhatsNew(update: PendingWhatsNewUpdate | null): void {
  pending = update;
}

export function getPendingWhatsNew(): PendingWhatsNewUpdate | null {
  return pending;
}
