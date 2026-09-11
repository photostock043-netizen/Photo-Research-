// masterLoader.js
// Loads the static product master data (generated from itemMaster.txt)
// and exposes a fast barcode -> product lookup.

let productsCache = null;
let barcodeIndexCache = null;
let loadingPromise = null;

async function loadMasterData() {
  if (productsCache && barcodeIndexCache) {
    return { products: productsCache, barcodeIndex: barcodeIndexCache };
  }
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const [productsRes, barcodeRes] = await Promise.all([
      fetch("products.json"),
      fetch("barcodeIndex.json"),
    ]);

    if (!productsRes.ok || !barcodeRes.ok) {
      throw new Error("ไม่สามารถโหลดข้อมูล master ได้ (products.json / barcodeIndex.json)");
    }

    productsCache = await productsRes.json();
    barcodeIndexCache = await barcodeRes.json();

    return { products: productsCache, barcodeIndex: barcodeIndexCache };
  })();

  return loadingPromise;
}

/**
 * Look up a product by scanned/typed barcode.
 * Returns the product object (itemNo, barcode[], description, group, price)
 * or null if not found.
 */
async function lookupByBarcode(barcode) {
  const { products, barcodeIndex } = await loadMasterData();
  const cleaned = String(barcode).trim();
  const itemNo = barcodeIndex[cleaned];
  if (!itemNo) return null;
  return products[itemNo] || null;
}

/**
 * Look up a product directly by itemNo (used when rendering search results).
 */
async function lookupByItemNo(itemNo) {
  const { products } = await loadMasterData();
  return products[itemNo] || null;
}

window.MasterLoader = { loadMasterData, lookupByBarcode, lookupByItemNo };
