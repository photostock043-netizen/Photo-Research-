// app-search.js
// Wires the "Search" page: search by photo (top 5 similar), and search by
// Barcode / Item No / Tag (exact product + 3-5 visually similar products,
// falling back to a tag match when nothing else is found). Every result
// card can also open a gallery of every photo ever stored for that item.

const els = {};
try {
  Object.assign(els, {
    cameraBtn: document.getElementById("cameraBtn"),
    galleryBtn: document.getElementById("galleryBtn"),
    cameraInput: document.getElementById("cameraInput"),
    galleryInput: document.getElementById("galleryInput"),
    photoThumbs: document.getElementById("photoThumbs"),
    searchBtn: document.getElementById("searchBtn"),
    status: document.getElementById("status"),
    photoResults: document.getElementById("photoResults"),

    tagInput: document.getElementById("tagInput"),
    tagSearchBtn: document.getElementById("tagSearchBtn"),
    tagStatus: document.getElementById("tagStatus"),
    tagExactResult: document.getElementById("tagExactResult"),
    similarWrap: document.getElementById("similarWrap"),
    similarResults: document.getElementById("similarResults"),

    photoModalOverlay: document.getElementById("photoModalOverlay"),
    photoModalTitle: document.getElementById("photoModalTitle"),
    photoModalGrid: document.getElementById("photoModalGrid"),
    photoModalClose: document.getElementById("photoModalClose"),
  });

  for (const [key, el] of Object.entries(els)) {
    if (!el) throw new Error(`ไม่พบ element id="${key}" ใน search.html — ไฟล์ HTML กับ JS อาจไม่ตรงเวอร์ชันกัน`);
  }
} catch (err) {
  console.error(err);
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = "โหลดหน้าไม่สำเร็จ: " + err.message;
  throw err;
}

// Accumulated search photos, from either the camera or the gallery picker.
// Each entry: { file, objectUrl }
let searchPhotos = [];

function setStatus(msg) {
  els.status.textContent = msg;
}

function renderSearchThumbs() {
  els.photoThumbs.innerHTML = "";
  searchPhotos.forEach((p, idx) => {
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
      searchPhotos.splice(idx, 1);
      renderSearchThumbs();
    });
    item.appendChild(removeBtn);

    els.photoThumbs.appendChild(item);
  });

  els.photoResults.innerHTML = "";
  setStatus(
    searchPhotos.length
      ? `เลือกไว้ ${searchPhotos.length} รูป พร้อมค้นหา`
      : "กรุณาถ่ายรูปหรือเลือกรูปอย่างน้อย 1 รูป"
  );
}

function addSearchFiles(fileList) {
  for (const file of Array.from(fileList)) {
    searchPhotos.push({ file, objectUrl: URL.createObjectURL(file) });
  }
  renderSearchThumbs();
}

els.cameraBtn.addEventListener("click", () => els.cameraInput.click());
els.cameraInput.addEventListener("change", () => {
  if (els.cameraInput.files.length) addSearchFiles(els.cameraInput.files);
  els.cameraInput.value = "";
});

els.galleryBtn.addEventListener("click", () => els.galleryInput.click());
els.galleryInput.addEventListener("change", () => {
  if (els.galleryInput.files.length) addSearchFiles(els.galleryInput.files);
  els.galleryInput.value = "";
});

// ---------- "ดูรูปอื่นๆ" photo gallery modal ----------

function openPhotoModal(title) {
  els.photoModalTitle.textContent = title;
  els.photoModalOverlay.classList.add("open");
}
function closePhotoModal() {
  els.photoModalOverlay.classList.remove("open");
  els.photoModalGrid.innerHTML = "";
}
els.photoModalClose.addEventListener("click", closePhotoModal);
els.photoModalOverlay.addEventListener("click", (e) => {
  if (e.target === els.photoModalOverlay) closePhotoModal();
});

async function showAllPhotos(itemNo, productDescription) {
  openPhotoModal(`รูปทั้งหมด: ${productDescription}`);
  els.photoModalGrid.innerHTML = "";

  const images = await ProductDB.getImagesByItemNo(itemNo);
  if (images.length === 0) {
    els.photoModalGrid.innerHTML = '<div class="photo-modal-empty">ยังไม่มีรูปของสินค้านี้ในฐานข้อมูล</div>';
    return;
  }
  for (const rec of images) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(rec.imageBlob);
    img.alt = productDescription;
    els.photoModalGrid.appendChild(img);
  }
}

/**
 * Renders one result card. `badge` is the small colored label
 * (e.g. "94.2% ตรงกัน" or "ตรงกับ Barcode/Tag"). Every card gets a
 * "ดูรูปอื่นๆ" button that opens the full photo gallery for that item.
 */
function renderResultCard(container, product, badgeText, badgeClass, thumbUrl) {
  const card = document.createElement("div");
  card.className = "result-card";
  card.innerHTML = `
    ${thumbUrl ? `<img class="result-thumb" src="${thumbUrl}" alt="${product.description}" />` : ""}
    <div class="result-card-body">
      <div class="${badgeClass}">${badgeText}</div>
      <div class="result-desc">${product.description}</div>
      <div class="result-meta">Item No: ${product.itemNo} · ราคา: ${product.price}</div>
      <div class="result-meta">Barcode: ${product.barcode.join(", ")}</div>
      <button type="button" class="btn-view-photos">🖼️ ดูรูปอื่นๆ</button>
    </div>
  `;
  card.querySelector(".btn-view-photos").addEventListener("click", () => {
    showAllPhotos(product.itemNo, product.description);
  });
  container.appendChild(card);
}

// ---------- Search by photo ----------

els.searchBtn.addEventListener("click", async () => {
  if (searchPhotos.length === 0) {
    setStatus("กรุณาถ่ายรูปหรือเลือกรูปอย่างน้อย 1 รูป");
    return;
  }

  try {
    const vectors = [];
    const colorHists = [];
    for (let i = 0; i < searchPhotos.length; i++) {
      setStatus(`กำลังประมวลผลรูปที่ ${i + 1}/${searchPhotos.length} (AI Vision)...`);
      const imgEl = await Vision.loadImageFromBlob(searchPhotos[i].file);
      vectors.push(await Vision.embedImage(imgEl));
      colorHists.push(Vision.extractColorHistogram(imgEl));
    }

    // Combine multiple photos into one query using vector math:
    // normalize + average, so several angles/lighting of the same item
    // give a more robust query than any single photo alone.
    const queryVector = Search.averageVectors(vectors);
    const queryColorHist = Search.averageVectors(colorHists);

    const allRecords = await ProductDB.getAllImageRecords();
    if (allRecords.length === 0) {
      setStatus("ยังไม่มีรูปสินค้าในฐานข้อมูล กรุณาเพิ่มรูป + Barcode ก่อน (หน้าเพิ่มข้อมูล)");
      return;
    }

    setStatus(`กำลังค้นหาสินค้าที่คล้ายกัน... (เทียบกับ ${allRecords.length} รูปในเครื่อง)`);
    const matches = Search.searchByVector(
      { vector: queryVector, colorHist: queryColorHist },
      allRecords,
      5
    );
    const recordsById = new Map(allRecords.map((r) => [r.id, r]));

    els.photoResults.innerHTML = "";
    for (const match of matches) {
      const product = await MasterLoader.lookupByItemNo(match.itemNo);
      if (!product) continue;
      const matchedRecord = recordsById.get(match.recordId);
      const thumbUrl = matchedRecord ? URL.createObjectURL(matchedRecord.imageBlob) : "";
      const pct = (match.similarity * 100).toFixed(1);
      renderResultCard(els.photoResults, product, `${pct}% ตรงกัน`, "result-sim", thumbUrl);
    }

    setStatus(`พบ ${matches.length} รายการที่ใกล้เคียงที่สุด (จากรูป ${searchPhotos.length} รูปที่เลือก)`);
  } catch (err) {
    console.error(err);
    setStatus("เกิดข้อผิดพลาดระหว่างค้นหา: " + err.message);
  }
});

// ---------- Search by Barcode / Item No / Tag ----------

async function renderTagMatches(rawQuery) {
  const tagMatches = await ProductDB.searchByTagText(rawQuery);
  if (tagMatches.length === 0) {
    els.tagStatus.textContent = `ไม่พบสินค้า: ${rawQuery}`;
    return;
  }

  for (const match of tagMatches) {
    const product = await MasterLoader.lookupByItemNo(match.itemNo);
    if (!product) continue;
    const thumbUrl = match.imageBlob ? URL.createObjectURL(match.imageBlob) : "";
    renderResultCard(els.tagExactResult, product, "ตรงกับ Tag", "result-exact", thumbUrl);
  }

  els.tagStatus.textContent = `พบ ${tagMatches.length} สินค้าที่ตรงกับ Tag: ${rawQuery}`;
}

els.tagSearchBtn.addEventListener("click", async () => {
  const raw = els.tagInput.value.trim();
  els.tagExactResult.innerHTML = "";
  els.similarResults.innerHTML = "";
  els.similarWrap.style.display = "none";

  if (!raw) {
    els.tagStatus.textContent = "กรุณากรอก Barcode, Item No หรือ Tag";
    return;
  }

  try {
    els.tagStatus.textContent = "กำลังค้นหา...";

    // Try as a barcode first, then fall back to treating it as an itemNo,
    // then finally fall back to a tag search across stored photos.
    let product = await MasterLoader.lookupByBarcode(raw);
    if (!product) {
      product = await MasterLoader.lookupByItemNo(raw);
    }

    if (!product) {
      await renderTagMatches(raw);
      return;
    }

    const itemImages = await ProductDB.getImagesByItemNo(product.itemNo);
    const exactThumb = itemImages.length ? URL.createObjectURL(itemImages[0].imageBlob) : "";
    renderResultCard(els.tagExactResult, product, "ตรงกับ Barcode/Tag", "result-exact", exactThumb);

    if (itemImages.length === 0) {
      els.tagStatus.textContent = "พบสินค้าตรงกัน (ยังไม่มีรูปของสินค้านี้ในฐานข้อมูล จึงยังแนะนำสินค้าใกล้เคียงไม่ได้)";
      return;
    }

    els.tagStatus.textContent = "พบสินค้าตรงกัน กำลังค้นหาสินค้าใกล้เคียง...";

    const queryVector = itemImages[0].vector;
    const queryColorHist = itemImages[0].colorHist;
    const allRecords = await ProductDB.getAllImageRecords();
    const matches = Search.searchByVector(
      { vector: queryVector, colorHist: queryColorHist },
      allRecords,
      5,
      product.itemNo
    );
    const recordsById = new Map(allRecords.map((r) => [r.id, r]));

    if (matches.length === 0) {
      els.tagStatus.textContent = "พบสินค้าตรงกัน (ยังไม่มีสินค้าอื่นในฐานข้อมูลให้เปรียบเทียบ)";
      return;
    }

    els.similarWrap.style.display = "block";
    for (const match of matches) {
      const simProduct = await MasterLoader.lookupByItemNo(match.itemNo);
      if (!simProduct) continue;
      const matchedRecord = recordsById.get(match.recordId);
      const thumbUrl = matchedRecord ? URL.createObjectURL(matchedRecord.imageBlob) : "";
      const pct = (match.similarity * 100).toFixed(1);
      renderResultCard(els.similarResults, simProduct, `${pct}% ใกล้เคียง`, "result-sim", thumbUrl);
    }

    els.tagStatus.textContent = `พบสินค้าตรงกัน และสินค้าใกล้เคียง ${matches.length} รายการ`;
  } catch (err) {
    console.error(err);
    els.tagStatus.textContent = "เกิดข้อผิดพลาดระหว่างค้นหา: " + err.message;
  }
});

(async function init() {
  try {
    setStatus("กำลังโหลดข้อมูลสินค้า...");
    await MasterLoader.loadMasterData();
    await Vision.loadModel();
    setStatus("พร้อมใช้งาน — ถ่ายรูปสินค้า หรือค้นหาด้วย Barcode/Tag");
  } catch (err) {
    console.error(err);
    setStatus("โหลดระบบไม่สำเร็จ: " + err.message + " (ลองรีเฟรชหน้าใหม่)");
  }
})();
