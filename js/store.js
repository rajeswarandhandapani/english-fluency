// IndexedDB storage on this device: daily logs, local audio recordings, and settings.
// Nothing leaves the device unless you download a JSON backup.

import { createDb } from '../lib/idb.js';

const db = createDb({
  name: 'english-fluency',
  version: 1,
  stores: [
    { name: 'days', keyPath: 'date' },
    { name: 'recordings', keyPath: 'date' },
    { name: 'kv' },
  ],
});

export const allDays = () => db.getAll('days');
export const putDay = day => db.put('days', day);
export const deleteDay = date => db.del('days', date);

export const getRecording = date => db.get('recordings', date);
export const putRecording = rec => db.put('recordings', rec);
export const deleteRecording = date => db.del('recordings', date);
export const allRecordings = () => db.getAll('recordings');
export const clearRecordings = () => db.clear('recordings');

export async function allRecordingMeta() {
  const list = await allRecordings();
  return (list || []).map(r => ({
    date: r.date,
    durationSec: r.durationSec || 0,
    size: r.blob?.size || 0,
    createdAt: r.createdAt || null,
  }));
}

export const getKv = key => db.getKv(key);
export const setKv = (key, value) => db.setKv(key, value);

export const eraseAll = () => db.eraseAll();

export const replaceAll = (days, settings) => db.run(['days', 'kv'], 'readwrite', t => {
  const dayStore = t.objectStore('days');
  dayStore.clear();
  days.forEach(d => dayStore.put(d));
  t.objectStore('kv').put(settings, 'settings');
});
