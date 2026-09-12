const DB_NAME = 'PhotoResearchDB';
const DB_VERSION = 2; // อัปเกรดเวอร์ชันเพื่อรองรับฟิลด์ใหม่
const STORE_NAME = 'products';

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('barcode', 'barcode', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.target.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addProduct(product) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(product);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllProducts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getProductByBarcode(barcode) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('barcode');
    const req = index.getAll(barcode);

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
