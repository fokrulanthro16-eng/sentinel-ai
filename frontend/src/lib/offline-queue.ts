/* Client-side offline queue backed by IndexedDB.
   Two stores:
     'queue'         — incident reports (original)
     'request-queue' — resource requests (new)
   The SW flushes both stores on reconnect.
*/

export interface QueuedIncident {
  id: string;
  body: string;       // JSON-stringified IncidentCreate payload
  queuedAt: number;
}

export interface QueuedResourceRequest {
  id: string;
  body: string;       // JSON-stringified ResourceRequestCreate payload
  queuedAt: number;
}

const DB_NAME    = 'sentinel-offline';
const DB_VERSION = 2;            // bumped for new store
const STORE      = 'queue';
const REQ_STORE  = 'request-queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(REQ_STORE)) {
        db.createObjectStore(REQ_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function enqueueIncident(payload: object): Promise<string> {
  const db   = await openDB();
  const id   = crypto.randomUUID();
  const item: QueuedIncident = { id, body: JSON.stringify(payload), queuedAt: Date.now() };

  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(item);
    req.onerror  = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });

  // Request background sync so the SW can flush when back online
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    // Background Sync API — only available in Chromium
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ('sync' in (reg as any)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (reg as any).sync.register('incident-sync');
    }
  }

  db.close();
  return id;
}

export async function getQueuedIncidents(): Promise<QueuedIncident[]> {
  const db = await openDB();
  const items = await new Promise<QueuedIncident[]>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedIncident[]);
    req.onerror   = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function dequeueIncident(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });
  db.close();
}

/** Flush incident queue against a live API. Returns count of successfully sent items. */
export async function flushQueue(apiUrl: string): Promise<number> {
  const items = await getQueuedIncidents();
  let flushed = 0;
  for (const item of items) {
    try {
      const res = await fetch(`${apiUrl}/api/incidents`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    item.body,
      });
      if (res.ok) {
        await dequeueIncident(item.id);
        flushed++;
      }
    } catch { /* keep for next attempt */ }
  }
  return flushed;
}

// ── Resource Request offline queue ────────────────────────────────────────────

export async function enqueueResourceRequest(payload: object): Promise<string> {
  const db  = await openDB();
  const id  = crypto.randomUUID();
  const item: QueuedResourceRequest = { id, body: JSON.stringify(payload), queuedAt: Date.now() };

  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(REQ_STORE, 'readwrite');
    const req = tx.objectStore(REQ_STORE).put(item);
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ('sync' in (reg as any)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (reg as any).sync.register('request-sync');
    }
  }

  db.close();
  return id;
}

export async function getQueuedRequests(): Promise<QueuedResourceRequest[]> {
  const db = await openDB();
  const items = await new Promise<QueuedResourceRequest[]>((resolve, reject) => {
    const req = db.transaction(REQ_STORE, 'readonly').objectStore(REQ_STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedResourceRequest[]);
    req.onerror   = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function dequeueRequest(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(REQ_STORE, 'readwrite');
    const req = tx.objectStore(REQ_STORE).delete(id);
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });
  db.close();
}

/** Flush resource request queue. Returns count of successfully sent items. */
export async function flushRequestQueue(apiUrl: string): Promise<number> {
  const items = await getQueuedRequests();
  let flushed = 0;
  for (const item of items) {
    try {
      const res = await fetch(`${apiUrl}/api/resources/requests`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    item.body,
      });
      if (res.ok) {
        await dequeueRequest(item.id);
        flushed++;
      }
    } catch { /* keep for next attempt */ }
  }
  return flushed;
}
