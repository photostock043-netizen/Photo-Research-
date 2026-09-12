// app-input.js
// Wires the "Add data" page: camera capture and/or gallery selection both
// feed one accumulating list of pending photos. A mandatory jewelry
// category (type / style / color) plus optional free-text tags get saved
// with every photo in that batch.

const { CATEGORY_TREE } = window.CategoryTree;

const els = {
  pickCameraBtn: document.getElementById("pickCameraBtn"),
  pickGalleryBtn: document.getElementById("pickGalleryBtn"),
  cameraInput: document.getElementById("cameraInput"),
  galleryInput: document.getElementById("galleryInput"),
  pendingThumbs: document.getElementById("pendingThumbs"),
  pendingCount: document.getElementById("pendingCount"),
  barcodeInput: document.getElementById("barcodeInput"),
  mainCategorySelect: document.getElementById("mainCategorySelect"),
  typeSelect: document.getElementById("typeSelect"),
  styleFieldWrap: document.getElementById("styleFieldWrap"),
  styleSelect: document.getElementById("styleSelect"),
  colorSelect: document.getElementById("colorSelect"),
  tagsInput: document.getElementById("tagsInput"),
  addBtn: document.getElementById("addBtn"),
  clearPendingBtn: document.getElementById("clearPendingBtn"),
  status: document.getElementById("status"),
  photoCount: document.getElementById("photoCount"),
};

let pendingFiles = [];

function setStatus(msg) {
  els.status.textContent = msg;
}

function renderPendingThumbs() {
  els.pendingThumbs.innerHTML = "";
  for (const file of pendingFiles) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    els.pendingThumbs.appendChild(img);
  }
  els.pendingCount.textContent = pendingFiles.length
    ? `เลือกไว้ ${pendingFiles.length} รูป`
    : "";
}

function parseFreeTags(raw) {
  return raw
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

async function refreshPhotoCount() {
  const n = await ProductDB.countImages();
  els.photoCount.textContent = `รูปในเครื่องทั้งหมด: ${n}`;
}

// ---------- Category cascading select ----------

els.typeSelect.addEventListener("change", () => {
  const cfg = CATEGORY_TREE[els.typeSelect.value];
  if (cfg && cfg.hasStyle) {
    els.styleFieldWrap.style.display = "block";
    els.styleSelect.innerHTML =
      '<option value="">-- เลือกรูปแบบ --</option>' +
      cfg.styles.map((s) => `<option value="${s}">${s}</option>`).join("");
  } else {
    els.styleFieldWrap.style.display = "none";
    els.styleSelect.innerHTML = "";
  }
});

// ---------- Camera / gallery pickers ----------

els.pickCameraBtn.addEventListener("click", () => els.cameraInput.click());
els.pickGalleryBtn.addEventListener("click", () => els.galleryInput.click());

els.cameraInput.addEventListener("change", () => {
  pendingFiles = pendingFiles.concat(Array.from(els.cameraInput.files));
  renderPendingThumbs();
  els.cameraInput.value = ""; // allow capturing another shot immediately
});

els.galleryInput.addEventListener("change", () => {
  pendingFiles = pendingFiles.concat(Array.from(els.galleryInput.files));
  renderPendingThumbs();
  els.galleryInput.value = "";
});

els.clearPendingBtn.addEventListener("click", () => {
  pendingFiles = [];
  renderPendingThumbs();
  setStatus("ล้างรายการรูปที่เลือกแล้ว");
});

// ---------- Add to database ----------

els.addBtn.addEventListener("click", async () => {
  if (pendingFiles.length === 0) {
    setStatus("กรุณาถ่ายรูปหรือเลือกรูปอย่างน้อย 1 รูป");
    return;
  }
  const barcode = els.barcodeInput.value.trim();
  if (!barcode) {
    setStatus("กรุณากรอก Barcode ก่อนเพิ่มข้อมูล");
    return;
  }

  const mainCategory = els.mainCategorySelect.value;
  const type = els.typeSelect.value;
  if (!type) {
    setStatus("กรุณาเลือกประเภทสินค้า");
    return;
  }
  const cfg = CATEGORY_TREE[type];
  let style = "";
  if (cfg && cfg.hasStyle) {
    style = els.styleSelect.value;
    if (!style) {
      setStatus("กรุณาเลือกรูปแบบของสินค้า");
      return;
    }
  }
  const color = els.colorSelect.value;
  if (!color) {
    setStatus("กรุณาเลือกสีของสินค้า");
    return;
  }

  const categoryTags = [mainCategory, type, style, color].filter(Boolean);
  const freeTags = parseFreeTags(els.tagsInput.value);
  const tags = Array.from(new Set([...categoryTags, ...freeTags]));

  try {
    setStatus("กำลังค้นหาข้อมูลสินค้าจาก Barcode...");
    const product = await MasterLoader.lookupByBarcode(barcode);
    if (!product) {
      setStatus(`ไม่พบสินค้าที่ Barcode: ${barcode}`);
      return;
    }

    let done = 0;
    for (const file of pendingFiles) {
      done++;
      setStatus(`กำลังเพิ่มรูปที่ ${done}/${pendingFiles.length}...`);
      const imgEl = await Vision.loadImageFromBlob(file);
      const vector = await Vision.embedImage(imgEl);
      const colorHist = Vision.extractColorHistogram(imgEl);
      await ProductDB.addImageRecord({
        itemNo: product.itemNo,
        barcode,
        imageBlob: file,
        vector,
        colorHist,
        tags,
      });
    }

    setStatus(`เพิ่มสำเร็จ ${pendingFiles.length} รูป: ${product.description} (${product.itemNo})`);
    pendingFiles = [];
    renderPendingThumbs();
    await refreshPhotoCount();
  } catch (err) {
    console.error(err);
    setStatus("เกิดข้อผิดพลาด: " + err.message);
  }
});

(async function init() {
  try {
    setStatus("กำลังโหลดข้อมูลสินค้า...");
    await MasterLoader.loadMasterData();
    await Vision.loadModel();
    await refreshPhotoCount();
    setStatus("พร้อมใช้งาน — ถ่ายรูปหรือเลือกจากคลังเพื่อเริ่มต้น");
  } catch (err) {
    console.error(err);
    setStatus("โหลดระบบไม่สำเร็จ: " + err.message + " (ลองรีเฟรชหน้าใหม่)");
  }
})();
