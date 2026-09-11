// app-input.js
// Wires the "Add data" page: camera capture -> embedding -> save to IndexedDB.

const els = {
  photoInput: document.getElementById("photoInput"),
  preview: document.getElementById("preview"),
  barcodeInput: document.getElementById("barcodeInput"),
  addBtn: document.getElementById("addBtn"),
  status: document.getElementById("status"),
  photoCount: document.getElementById("photoCount"),
  batchPhotoInput: document.getElementById("batchPhotoInput"),
  batchThumbs: document.getElementById("batchThumbs"),
  batchBarcodeInput: document.getElementById("batchBarcodeInput"),
  batchAddBtn: document.getElementById("batchAddBtn"),
  batchStatus: document.getElementById("batchStatus"),
};

let currentBlob = null;
let currentImgEl = null;
let batchFiles = [];

function setStatus(msg) {
  els.status.textContent = msg;
}

async function refreshPhotoCount() {
  const n = await ProductDB.countImages();
  els.photoCount.textContent = `รูปในเครื่องทั้งหมด: ${n}`;
}

els.photoInput.addEventListener("change", async () => {
  const file = els.photoInput.files[0];
  if (!file) return;

  currentBlob = file;
  els.preview.src = URL.createObjectURL(file);
  els.preview.style.display = "block";
  setStatus("โหลดรูปแล้ว พร้อมเพิ่มเข้าฐานข้อมูล");

  currentImgEl = await Vision.loadImageFromBlob(file);
});

els.addBtn.addEventListener("click", async () => {
  if (!currentBlob || !currentImgEl) {
    setStatus("กรุณาถ่ายรูปก่อน");
    return;
  }
  const barcode = els.barcodeInput.value.trim();
  if (!barcode) {
    setStatus("กรุณากรอก Barcode ก่อนเพิ่มข้อมูล");
    return;
  }

  setStatus("กำลังค้นหาข้อมูลสินค้าจาก Barcode...");
  const product = await MasterLoader.lookupByBarcode(barcode);
  if (!product) {
    setStatus(`ไม่พบสินค้าที่ Barcode: ${barcode}`);
    return;
  }

  setStatus("กำลังประมวลผลรูปภาพ (AI Vision)...");
  const vector = await Vision.embedImage(currentImgEl);
  const colorHist = Vision.extractColorHistogram(currentImgEl);

  await ProductDB.addImageRecord({
    itemNo: product.itemNo,
    barcode,
    imageBlob: currentBlob,
    vector,
    colorHist,
  });

  setStatus(`เพิ่มรูปสำเร็จ: ${product.description} (${product.itemNo})`);
  await refreshPhotoCount();
});

els.batchPhotoInput.addEventListener("change", () => {
  batchFiles = Array.from(els.batchPhotoInput.files);
  els.batchThumbs.innerHTML = "";
  for (const file of batchFiles) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    els.batchThumbs.appendChild(img);
  }
  els.batchStatus.textContent = batchFiles.length
    ? `เลือกไว้ ${batchFiles.length} รูป`
    : "";
});

els.batchAddBtn.addEventListener("click", async () => {
  if (batchFiles.length === 0) {
    els.batchStatus.textContent = "กรุณาเลือกรูปอย่างน้อย 1 รูป";
    return;
  }
  const barcode = els.batchBarcodeInput.value.trim();
  if (!barcode) {
    els.batchStatus.textContent = "กรุณากรอก Barcode ก่อนเพิ่มข้อมูล";
    return;
  }

  els.batchStatus.textContent = "กำลังค้นหาข้อมูลสินค้าจาก Barcode...";
  const product = await MasterLoader.lookupByBarcode(barcode);
  if (!product) {
    els.batchStatus.textContent = `ไม่พบสินค้าที่ Barcode: ${barcode}`;
    return;
  }

  let done = 0;
  for (const file of batchFiles) {
    done++;
    els.batchStatus.textContent = `กำลังเพิ่มรูปที่ ${done}/${batchFiles.length}...`;
    const imgEl = await Vision.loadImageFromBlob(file);
    const vector = await Vision.embedImage(imgEl);
    const colorHist = Vision.extractColorHistogram(imgEl);
    await ProductDB.addImageRecord({
      itemNo: product.itemNo,
      barcode,
      imageBlob: file,
      vector,
      colorHist,
    });
  }

  els.batchStatus.textContent = `เพิ่มสำเร็จ ${batchFiles.length} รูป: ${product.description} (${product.itemNo})`;
  batchFiles = [];
  els.batchThumbs.innerHTML = "";
  els.batchPhotoInput.value = "";
  await refreshPhotoCount();
});

(async function init() {
  setStatus("กำลังโหลดข้อมูลสินค้า...");
  await MasterLoader.loadMasterData();
  await Vision.loadModel();
  await refreshPhotoCount();
  setStatus("พร้อมใช้งาน — ถ่ายรูปสินค้าเพื่อเริ่มต้น");
})();
