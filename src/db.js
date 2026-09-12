// db.js
// IndexedDB wrapper for the user's personal "knowledge base":
// photos + embedding vectors captured on this device.

const DB_NAME = "productSearchDB";
const DB_VERSION = 2;
const STORE_IMAGES = "productImages";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      let store;
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        store = db.createObjectStore(STORE_IMAGES, { keyPath: "id" });
        store.createIndex("itemNo", "itemNo", { unique: false });
        store.createIndex("barcode", "barcode", { unique: false });
      } else {
        store = event.target.transaction.objectStore(STORE_IMAGES);
      }
      // v2: tags (multiEntry so each tag in the array is individually indexed)
      if (!store.indexNames.contains("tags")) {
        store.createIndex("tags", "tags", { unique: false, multiEntry: true });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Normalizes a raw tags string/array into a clean array of lowercase,
 * trimmed, de-duplicated tags (splits on comma if given a string).
 */
function normalizeTags(rawTags) {
  const list = Array.isArray(rawTags)
    ? rawTags
    : String(rawTags || "").split(",");
  const cleaned = list
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t.length > 0);
  return Array.from(new Set(cleaned));
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

/**
 * Save a newly captured image + its embedding vector.
 * vector must be a plain Array of numbers (Float32Array gets converted).
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
    tags: normalizeTags(tags),
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
 * Full-text-ish search across stored tags. Returns one representative
 * record per matching itemNo (the most recently added match), sorted by
 * how many of that item's photos matched the query (best coverage first).
 * `queryText` is matched as a case-insensitive substring against each tag.
 */
async function searchByTagText(queryText) {
  const q = String(queryText || "").trim().toLowerCase();
  if (!q) return [];

  const allRecords = await getAllImageRecords();
  const bestByItem = new Map(); // itemNo -> { record, matchCount }

  for (const record of allRecords) {
    const tags = record.tags || [];
    const matches = tags.some((t) => t.includes(q));
    if (!matches) continue;

    const existing = bestByItem.get(record.itemNo);
    if (!existing) {
      bestByItem.set(record.itemNo, { record, matchCount: 1 });
    } else {
      existing.matchCount++;
      if (record.createdAt > existing.record.createdAt) {
        existing.record = record;
      }
    }
  }

  return Array.from(bestByItem.values())
    .sort((a, b) => b.matchCount - a.matchCount)
    .map(({ record, matchCount }) => ({
      itemNo: record.itemNo,
      recordId: record.id,
      imageBlob: record.imageBlob,
      matchCount,
    }));
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
  searchByTagText,
  countImages,
};
