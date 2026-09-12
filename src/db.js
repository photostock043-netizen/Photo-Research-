// db.js
// IndexedDB wrapper for the user's personal "knowledge base":
// photos + embedding vectors (+ optional tags) captured on this device.

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
 * Save a newly captured image + its embedding vector (+ optional color
 * histogram and free-text tags). vector/colorHist get converted to plain
 * arrays; tags defaults to an empty array when not provided.
 */
async function addImageRecord({ itemNo, barcode, imageBlob, vector, colorHist, tags }) {
  const db = await openDB();
  const record = {
    id: uuid(),
    itemNo,
    barcode,
    imageBlob,
    vector: Array.from(vector),
    colorHist: colorHist ? Array.from(colorHist) : null,
    tags: Array.isArray(tags) ? tags : [],
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

/**
 * Free-text tag search across every stored record. Case-insensitive,
 * substring match (so "ทอง" matches a tag "แหวนทอง"). Small personal
 * dataset, so a full scan is fine — no need for a dedicated index.
 */
async function searchByTag(tagQuery) {
  const q = String(tagQuery).trim().toLowerCase();
  if (!q) return [];
  const all = await getAllImageRecords();
  return all.filter(
    (r) => Array.isArray(r.tags) && r.tags.some((t) => t.toLowerCase().includes(q))
  );
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

/**
 * Delete a single stored photo/record by its id.
 */
async function deleteRecord(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readwrite");
    tx.objectStore(STORE_IMAGES).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete every stored photo for one product (itemNo). Returns how many
 * records were removed.
 */
async function deleteByItemNo(itemNo) {
  const records = await getImagesByItemNo(itemNo);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readwrite");
    const store = tx.objectStore(STORE_IMAGES);
    for (const r of records) store.delete(r.id);
    tx.oncomplete = () => resolve(records.length);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Wipe every stored photo — used to reset during testing.
 */
async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readwrite");
    tx.objectStore(STORE_IMAGES).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

window.ProductDB = {
  addImageRecord,
  getAllImageRecords,
  getImagesByItemNo,
  searchByTag,
  countImages,
  deleteRecord,
  deleteByItemNo,
  clearAll,
};
