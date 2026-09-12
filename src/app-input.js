// app-input.js
// Wires the "Add data" page: camera/gallery capture -> accumulate photos ->
// embedding -> save to IndexedDB, all under one Barcode + optional Tags.

const els = {};
try {
  Object.assign(els, {
    cameraBtn: document.getElementById("cameraBtn"),
    galleryBtn: document.getElementById("galleryBtn"),
    cameraInput: document.getElementById("cameraInput"),
    galleryInput: document.getElementById("galleryInput"),
    photoThumbs: document.getElementById("photoThumbs"),
    photoThumbCount: document.getElementById("photoThumbCount"),
    barcodeInput: document.getElementById("barcodeInput"),
    tagsInput: document.getElementById("tagsInput"),
    addBtn: document.getElementById("addBtn"),
    status: document.getElementById("status"),
    photoCount: document.getElementById("photoCount"),
  });

  for (const [key, el] of Object.entries(els)) {
    if (!el) throw new Error(`ไม่พบ element id="${key}" ใน input.html — ไฟล์ HTML กับ JS อาจไม่ตรงเวอร์ชันกัน`);
  }
} catch (err) {
  console.error(err);
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = "โหลดหน้าไม่สำเร็จ: " + err.message;
  throw err;
}

// Accumulated photos, from either the camera or the gallery picker.
// Each entry: { file, objectUrl }
let photos = [];

function setStatus(msg) {
  els.status.textContent = msg;
}

async function refreshPhotoCount() {
  const n = await ProductDB.countImages();
  els.photoCount.textContent = `รูปในเครื่องทั้งหมด: ${n}`;
}

function renderThumbs() {
  els.photoThumbs.innerHTML = "";
  photos.forEach((p, idx) => {
    const item = document.createElement("div");
    item.className = "thumb-item";

    const img = document.createElement("img");
    img.src = p.objectUrl;
    item.appendChild(img);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "thumb-remove";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      URL.revokeObjectURL(p.objectUrl);
      photos.splice(idx, 1);
      renderThumbs();
    });
    item.appendChild(removeBtn);

    els.photoThumbs.appendChild(item);
  });

  els.photoThumbCount.textContent = photos.length
    ? `เลือกไว้ ${photos.length} รูป`
    : "";
}

function addFiles(fileList) {
  for (const file of Array.from(fileList)) {
    photos.push({ file, objectUrl: URL.createObjectURL(file) });
  }
  renderThumbs();
}

// "ถ่ายจากกล้อง" — opens the camera; can be pressed repeatedly to add more
// photos one at a time. Resetting the input's value lets the same camera
// input fire `change` again for a retake.
els.cameraBtn.addEventListener("click", () => {
  els.cameraInput.click();
});
els.cameraInput.addEventListener("change", () => {
  if (els.cameraInput.files.length) addFiles(els.cameraInput.files);
  els.cameraInput.value = "";
});

// "เลือกจากคลัง" — can select several photos at once; accumulates into
// the same list as the camera photos.
els.galleryBtn.addEventListener("click", () => {
  els.galleryInput.click();
});
els.galleryInput.addEventListener("change", () => {
  if (els.galleryInput.files.length) addFiles(els.galleryInput.files);
  els.galleryInput.value = "";
});

els.addBtn.addEventListener("click", async () => {
  if (photos.length === 0) {
    setStatus("กรุณาถ่ายรูปหรือเลือกรูปอย่างน้อย 1 รูป");
    return;
  }
  const barcode = els.barcodeInput.value.trim();
  if (!barcode) {
    setStatus("กรุณากรอก Barcode ก่อนเพิ่มข้อมูล");
    return;
  }
  const tags = els.tagsInput.value.trim();

  setStatus("กำลังค้นหาข้อมูลสินค้าจาก Barcode...");
  const product = await MasterLoader.lookupByBarcode(barcode);
  if (!product) {
    setStatus(`ไม่พบสินค้าที่ Barcode: ${barcode}`);
    return;
  }

  let done = 0;
  for (const p of photos) {
    done++;
    setStatus(`กำลังประมวลผลรูปที่ ${done}/${photos.length} (AI Vision)...`);
    const imgEl = await Vision.loadImageFromBlob(p.file);
    const vector = await Vision.embedImage(imgEl);
    const colorHist = Vision.extractColorHistogram(imgEl);
    await ProductDB.addImageRecord({
      itemNo: product.itemNo,
      barcode,
      imageBlob: p.file,
      vector,
      colorHist,
      tags,
    });
  }

  setStatus(`เพิ่มสำเร็จ ${photos.length} รูป: ${product.description} (${product.itemNo})`);

  photos.forEach((p) => URL.revokeObjectURL(p.objectUrl));
  photos = [];
  renderThumbs();
  els.tagsInput.value = "";
  await refreshPhotoCount();
});

(async function init() {
  try {
    setStatus("กำลังโหลดข้อมูลสินค้า...");
    await MasterLoader.loadMasterData();
    await Vision.loadModel();
    await refreshPhotoCount();
    setStatus("พร้อมใช้งาน — ถ่ายรูปสินค้าเพื่อเริ่มต้น");
  } catch (err) {
    console.error(err);
    setStatus("โหลดระบบไม่สำเร็จ: " + err.message + " (ลองรีเฟรชหน้าใหม่)");
  }
})();
