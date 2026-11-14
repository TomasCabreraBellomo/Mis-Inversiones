import { type Data } from './model';
let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  return dbPromise ??= new Promise((resolve, reject) => { const request = indexedDB.open('mis-inversiones', 1); request.onupgradeneeded = () => request.result.createObjectStore('portfolio'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('No se pudo abrir el almacenamiento local. Revisá los permisos del navegador.')); });
}
export interface Saved { data: Data; revision: number }
export async function load(): Promise<Saved | null> { const db = await database(); return new Promise((resolve, reject) => { const tx = db.transaction('portfolio', 'readonly'), req = tx.objectStore('portfolio').get('main'); req.onsuccess = () => resolve(req.result ?? null); req.onerror = () => reject(req.error); }); }
export async function save(data: Data, revision: number): Promise<number> {
  const db = await database();
  return new Promise((resolve, reject) => { const tx = db.transaction('portfolio', 'readwrite'); const store = tx.objectStore('portfolio'); let conflict = false; const req = store.get('main'); req.onsuccess = () => { if ((req.result?.revision ?? 0) !== revision) { conflict = true; tx.abort(); } else store.put({ data, revision: revision + 1 }, 'main'); }; tx.oncomplete = () => resolve(revision + 1); tx.onabort = () => reject(new Error(conflict ? 'La cartera cambió en otra pestaña. Recargá antes de guardar para no sobrescribirla.' : 'No se pudo guardar. Exportá un respaldo y revisá el espacio del dispositivo.')); tx.onerror = () => reject(tx.error); });
}
export function download(text: string, filename: string, type = 'text/csv;charset=utf-8') { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
