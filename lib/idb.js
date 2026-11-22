// Lightweight IndexedDB wrapper factory. All data stays local to this browser.

export function createDb({
  name,
  version = 1,
  stores = [{ name: 'items', keyPath: 'id' }, { name: 'kv' }],
}) {
  let dbp;

  function open() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(name, version);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const s of stores) {
            if (db.objectStoreNames.contains(s.name)) continue;
            db.createObjectStore(s.name, s.keyPath ? { keyPath: s.keyPath } : undefined);
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          db.onclose = () => { dbp = null; };
          db.onversionchange = () => { db.close(); dbp = null; };
          resolve(db);
        };
        req.onerror = () => { dbp = null; reject(req.error); };
        req.onblocked = () => { dbp = null; reject(new Error('Database blocked')); };
      });
    }
    return dbp;
  }

  async function run(storeNames, mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeNames, mode);
      let result;
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
      const out = work(t);
      if (out) out.onsuccess = () => { result = out.result; };
    });
  }

  const allNames = stores.map(s => s.name);

  return {
    open,
    run,
    getAll: store => run(store, 'readonly', t => t.objectStore(store).getAll()),
    get: (store, key) => run(store, 'readonly', t => t.objectStore(store).get(key)),
    put: (store, value) => run(store, 'readwrite', t => { t.objectStore(store).put(value); }),
    putMany: (store, list) => run(store, 'readwrite', t => {
      const os = t.objectStore(store);
      list.forEach(row => os.put(row));
    }),
    del: (store, key) => run(store, 'readwrite', t => { t.objectStore(store).delete(key); }),
    clear: store => run(store, 'readwrite', t => { t.objectStore(store).clear(); }),
    getKv: (key, store = 'kv') => run(store, 'readonly', t => t.objectStore(store).get(key)),
    setKv: (key, value, store = 'kv') => run(store, 'readwrite', t => { t.objectStore(store).put(value, key); }),
    eraseAll: () => run(allNames, 'readwrite', t => {
      allNames.forEach(s => t.objectStore(s).clear());
    }),
  };
}

let persisted = false;
export function requestPersist() {
  if (persisted) return;
  persisted = true;
  navigator?.storage?.persist?.().catch(() => { });
}
