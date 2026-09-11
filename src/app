// app.js
// Wires the UI together: camera capture -> embedding -> add to DB / search DB.

const els = {
  photoInput: document.getElementById("photoInput"),
  preview: document.getElementById("preview"),
  barcodeInput: document.getElementById("barcodeInput"),
  addBtn: document.getElementById("addBtn"),
  searchBtn: document.getElementById("searchBtn"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
  photoCount: document.getElementById("photoCount"),
};

let currentBlob = null;
let currentImgEl = null;

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
  els.results.innerHTML = "";
  setStatus("โหลดรูปแล้ว พร้อมเพิ่มเข้าฐานข้อมูล หรือค้นหา");

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

  await ProductDB.addImageRecord({
    itemNo: product.itemNo,
    barcode,
    imageBlob: currentBlob,
    vector,
  });

  setStatus(`เพิ่มรูปสำเร็จ: ${product.description} (${product.itemNo})`);
  await refreshPhotoCount();
});

els.searchBtn.addEventListener("click", async () => {
  if (!currentBlob || !currentImgEl) {
    setStatus("กรุณาถ่ายรูปก่อน");
    return;
  }

  setStatus("กำลังประมวลผลรูปภาพ (AI Vision)...");
  const queryVector = await Vision.embedImage(currentImgEl);

  const allRecords = await ProductDB.getAllImageRecords();
  if (allRecords.length === 0) {
    setStatus("ยังไม่มีรูปสินค้าในฐานข้อมูล กรุณาเพิ่มรูป + Barcode ก่อน");
    return;
  }

  setStatus("กำลังค้นหาสินค้าที่คล้ายกัน...");
  const matches = Search.searchByVector(queryVector, allRecords, 5);

  els.results.innerHTML = "";
  for (const match of matches) {
    const product = await MasterLoader.lookupByItemNo(match.itemNo);
    if (!product) continue;

    const pct = (match.similarity * 100).toFixed(1);
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-sim">${pct}% ตรงกัน</div>
      <div class="result-desc">${product.description}</div>
      <div class="result-meta">Item No: ${product.itemNo} · ราคา: ${product.price}</div>
      <div class="result-meta">Barcode: ${product.barcode.join(", ")}</div>
    `;
    els.results.appendChild(card);
  }

  setStatus(`พบ ${matches.length} รายการที่ใกล้เคียงที่สุด`);
});

(async function init() {
  setStatus("กำลังโหลดข้อมูลสินค้า...");
  await MasterLoader.loadMasterData();
  await Vision.loadModel();
  await refreshPhotoCount();
  setStatus("พร้อมใช้งาน — ถ่ายรูปสินค้าเพื่อเริ่มต้น");
})();
