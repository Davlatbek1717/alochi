/**
 * Phase 18.7 — IndexedDB-backed offline queue for kiosk check-ins.
 *
 * Pattern:
 *   - enqueue() appends a payload (and timestamp) to the named store.
 *   - peek() returns the oldest item without removing it.
 *   - dequeue() removes the oldest item.
 *   - drain(fn) tries fn(item) on each item until either the queue is
 *     empty or fn throws (network still down) — returns the count drained.
 *
 * Implementation uses raw IndexedDB (no extra dependencies). The store
 * uses an auto-incrementing key so insertion order = drain order.
 */

const DB_NAME = 'kiosk_offline';
const DB_VERSION = 1;

type QueueRecord<T> = { id?: number; ts: number; payload: T };

async function openDb(storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // If this is a known DB but the store hasn't been registered yet,
      // bump version to add it. Avoid infinite loop by closing first.
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        const newVersion = db.version + 1;
        const upgradeReq = indexedDB.open(DB_NAME, newVersion);
        upgradeReq.onupgradeneeded = () => {
          upgradeReq.result.createObjectStore(storeName, {
            keyPath: 'id',
            autoIncrement: true,
          });
        };
        upgradeReq.onsuccess = () => resolve(upgradeReq.result);
        upgradeReq.onerror = () => reject(upgradeReq.error);
      } else {
        resolve(db);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export class OfflineQueue<T> {
  constructor(private storeName: string) {}

  async enqueue(payload: T): Promise<void> {
    const db = await openDb(this.storeName);
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const record: QueueRecord<T> = { ts: Date.now(), payload };
        const req = store.add(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async peek(): Promise<QueueRecord<T> | null> {
    const db = await openDb(this.storeName);
    try {
      return await new Promise<QueueRecord<T> | null>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            resolve(null);
            return;
          }
          resolve(cursor.value as QueueRecord<T>);
        };
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async dequeue(id: number): Promise<void> {
    const db = await openDb(this.storeName);
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const req = tx.objectStore(this.storeName).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async size(): Promise<number> {
    const db = await openDb(this.storeName);
    try {
      return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  /**
   * Drain the queue, invoking `send` on each payload until either it
   * throws (network still down) or the queue is empty. Returns the count
   * successfully drained.
   */
  async drain(send: (payload: T) => Promise<void>): Promise<number> {
    let drained = 0;
    while (true) {
      const head = await this.peek();
      if (!head || head.id === undefined) return drained;
      try {
        await send(head.payload);
      } catch {
        return drained; // stop — network or server still failing
      }
      await this.dequeue(head.id);
      drained++;
    }
  }
}

export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (err instanceof TypeError) return true; // fetch network errors
  return false;
}
