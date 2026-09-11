// db.js
// IndexedDB wrapper for the user's personal "knowledge base":
// photos + embedding vectors captured on this device.

const DB_NAME = "productSearchDB";
const DB_VERSION = 1;
const STORE_IMAGES = "productImages";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        const store = db.createObjectStore(STORE_IMAGES, { keyPath: "id" });
        store.createIndex("itemNo", "itemNo", { unique: false });
        store.createIndex("barcode", "barcode", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

/**
 * Save a newly captured image + its embedding vector.
 * vector must be a plain Array of numbers (Float32Array gets converted).
 */
async function addImageRecord({ itemNo, barcode, imageBlob, vector }) {
  const db = await openDB();
  const record = {
    id: uuid(),
    itemNo,
    barcode,
    imageBlob,
    vector: Array.from(vector),
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readwrite");
    tx.objectStore(STORE_IMAGES).add(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Return every stored image record (used for brute-force similarity search).
 */
async function getAllImageRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readonly");
    const req = tx.objectStore(STORE_IMAGES).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Return all stored images for one specific product (itemNo).
 */
async function getImagesByItemNo(itemNo) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readonly");
    const idx = tx.objectStore(STORE_IMAGES).index("itemNo");
    const req = idx.getAll(itemNo);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function countImages() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readonly");
    const req = tx.objectStore(STORE_IMAGES).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

window.ProductDB = {
  addImageRecord,
  getAllImageRecords,
  getImagesByItemNo,
  countImages,
};
