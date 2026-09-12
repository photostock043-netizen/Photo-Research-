// app-search.js
// Wires the "Search" page: search by photo (camera and/or gallery, multiple
// photos averaged into one query), and search by Barcode / Item No / Tag
// (exact product + 3-5 visually similar products). Every result card can
// expand to show every other photo stored for that product.

const { CATEGORY_TREE } = window.CategoryTree;

const els = {
  pickCameraBtn: document.getElementById("pickCameraBtn"),
  pickGalleryBtn: document.getElementById("pickGalleryBtn"),
  cameraInput: document.getElementById("cameraInput"),
  galleryInput: document.getElementById("galleryInput"),
  photoThumbs: document.getElementById("photoThumbs"),
  filterTypeSelect: document.getElementById("filterTypeSelect"),
  filterStyleWrap: document.getElementById("filterStyleWrap"),
  filterStyleSelect: document.getElementById("filterStyleSelect"),
  filterColorSelect: document.getElementById("filterColorSelect"),
  searchBtn: document.getElementById("searchBtn"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  status: document.getElementById("status"),
  photoResults: document.getElementById("photoResults"),

  tagInput: document.getElementById("tagInput"),
  tagSearchBtn: document.getElementById("tagSearchBtn"),
  tagStatus: document.getElementById("tagStatus"),
  tagExactResult: document.getElementById("tagExactResult"),
  similarWrap: document.getElementById("similarWrap"),
  similarResults: document.getElementById("similarResults"),
};

let searchFiles = [];

els.filterTypeSelect.addEventListener("change", () => {
  const cfg = CATEGORY_TREE[els.filterTypeSelect.value];
  if (cfg && cfg.hasStyle) {
    els.filterStyleWrap.style.display = "block";
    els.filterStyleSelect.innerHTML =
      '<option value="">-- ทุกรูปแบบ --</option>' +
      cfg.styles.map((s) => `<option value="${s}">${s}</option>`).join("");
  } else {
    els.filterStyleWrap.style.display = "none";
    els.filterStyleSelect.innerHTML = "";
  }
});

function getActiveFilterTags() {
  return [
    els.filterTypeSelect.value,
    els.filterStyleSelect.value,
    els.filterColorSelect.value,
  ].filter(Boolean);
}

function recordMatchesFilters(record, filterTags) {
  if (!filterTags.length) return true;
  if (!Array.isArray(record.tags)) return false;
  return filterTags.every((ft) => record.tags.includes(ft));
}

function setStatus(msg) {
  els.status.textContent = msg;
}

/**
 * Renders one result card, with an optional "view other photos" toggle
 * when more than one stored photo exists for that product.
 * otherRecords: array of { imageBlob, ... } — every stored photo for this itemNo.
 */
function renderResultCard(container, product, badgeText, badgeClass, thumbUrl, otherRecords = []) {
  const wrap = document.createElement("div");
  wrap.className = "result-card-wrap";

  const card = document.createElement("div");
  card.className = "result-card";
  card.innerHTML = `
    ${thumbUrl ? `<img class="result-thumb" src="${thumbUrl}" alt="${product.description}" />` : ""}
    <div>
      <div class="${badgeClass}">${badgeText}</div>
      <div class="result-desc">${product.description}</div>
      <div class="result-meta">Item No: ${product.itemNo} · ราคา: ${product.price}</div>
      <div class="result-meta">Barcode: ${product.barcode.join(", ")}</div>
    </div>
  `;
  wrap.appendChild(card);

  if (otherRecords.length > 1) {
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "view-other-btn";
    toggleBtn.textContent = `📷 ดูรูปอื่นๆ (${otherRecords.length})`;

    const gallery = document.createElement("div");
    gallery.className = "other-photos-gallery";
    for (const rec of otherRecords) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(rec.imageBlob);
      gallery.appendChild(img);
    }

    toggleBtn.addEventListener("click", () => {
      const isOpen = gallery.style.display === "flex";
      gallery.style.display = isOpen ? "none" : "flex";
    });

    wrap.appendChild(toggleBtn);
    wrap.appendChild(gallery);
  }

  container.appendChild(wrap);
}

// ---------- Search by photo (camera and/or gallery) ----------

els.pickCameraBtn.addEventListener("click", () => els.cameraInput.click());
els.pickGalleryBtn.addEventListener("click", () => els.galleryInput.click());

function addSearchFiles(files) {
  searchFiles = searchFiles.concat(files);
  els.photoThumbs.innerHTML = "";
  for (const file of searchFiles) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    els.photoThumbs.appendChild(img);
  }
  els.photoResults.innerHTML = "";
  setStatus(`เลือกไว้ ${searchFiles.length} รูป พร้อมค้นหา`);
}

els.cameraInput.addEventListener("change", () => {
  addSearchFiles(Array.from(els.cameraInput.files));
  els.cameraInput.value = "";
});

els.galleryInput.addEventListener("change", () => {
  addSearchFiles(Array.from(els.galleryInput.files));
  els.galleryInput.value = "";
});

els.clearSearchBtn.addEventListener("click", () => {
  searchFiles = [];
  els.photoThumbs.innerHTML = "";
  els.photoResults.innerHTML = "";
  setStatus("ล้างรูปที่เลือกแล้ว");
});

els.searchBtn.addEventListener("click", async () => {
  if (searchFiles.length === 0) {
    setStatus("กรุณาถ่ายรูปหรือเลือกรูปอย่างน้อย 1 รูป");
    return;
  }

  try {
    const vectors = [];
    const colorHists = [];
    for (let i = 0; i < searchFiles.length; i++) {
      setStatus(`กำลังประมวลผลรูปที่ ${i + 1}/${searchFiles.length} (AI Vision)...`);
      const imgEl = await Vision.loadImageFromBlob(searchFiles[i]);
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

    const filterTags = getActiveFilterTags();
    const candidateRecords = allRecords.filter((r) => recordMatchesFilters(r, filterTags));
    if (filterTags.length && candidateRecords.length === 0) {
      setStatus(`ไม่มีสินค้าที่ตรงกับหมวดหมู่ที่กรองไว้ (${filterTags.join(" / ")}) ในฐานข้อมูล`);
      return;
    }

    setStatus(`กำลังค้นหาสินค้าที่คล้ายกัน... (เทียบกับ ${candidateRecords.length} รูปในเครื่อง)`);
    const matches = Search.searchByVector(
      { vector: queryVector, colorHist: queryColorHist },
      candidateRecords,
      5
    );
    const recordsById = new Map(candidateRecords.map((r) => [r.id, r]));

    els.photoResults.innerHTML = "";
    for (const match of matches) {
      const product = await MasterLoader.lookupByItemNo(match.itemNo);
      if (!product) continue;
      const matchedRecord = recordsById.get(match.recordId);
      const thumbUrl = matchedRecord ? URL.createObjectURL(matchedRecord.imageBlob) : "";
      const pct = (match.similarity * 100).toFixed(1);
      const otherRecords = allRecords.filter((r) => r.itemNo === match.itemNo);
      renderResultCard(els.photoResults, product, `${pct}% ตรงกัน`, "result-sim", thumbUrl, otherRecords);
    }

    setStatus(`พบ ${matches.length} รายการที่ใกล้เคียงที่สุด (จากรูป ${searchFiles.length} รูปที่เลือก)`);
  } catch (err) {
    console.error(err);
    setStatus("เกิดข้อผิดพลาดระหว่างค้นหา: " + err.message);
  }
});

// ---------- Search by Barcode / Item No / Tag ----------

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

    // 1) Try as a barcode, 2) then as an itemNo — both are exact,
    // single-product matches with a "similar items" recommendation.
    let product = await MasterLoader.lookupByBarcode(raw);
    if (!product) {
      product = await MasterLoader.lookupByItemNo(raw);
    }

    if (product) {
      const itemImages = await ProductDB.getImagesByItemNo(product.itemNo);
      const exactThumb = itemImages.length ? URL.createObjectURL(itemImages[0].imageBlob) : "";
      renderResultCard(els.tagExactResult, product, "ตรงกับ Barcode/Tag", "result-exact", exactThumb, itemImages);

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
        const otherRecords = allRecords.filter((r) => r.itemNo === match.itemNo);
        renderResultCard(els.similarResults, simProduct, `${pct}% ใกล้เคียง`, "result-sim", thumbUrl, otherRecords);
      }

      els.tagStatus.textContent = `พบสินค้าตรงกัน และสินค้าใกล้เคียง ${matches.length} รายการ`;
      return;
    }

    // 3) Not a barcode or itemNo — try matching against user-entered Tags.
    // A tag can match several different products, so list them all.
    const tagRecords = await ProductDB.searchByTag(raw);
    if (tagRecords.length === 0) {
      els.tagStatus.textContent = `ไม่พบสินค้า: ${raw}`;
      return;
    }

    const matchedItemNos = Array.from(new Set(tagRecords.map((r) => r.itemNo)));
    els.tagStatus.textContent = `พบ ${matchedItemNos.length} สินค้าที่มี Tag ตรงกับ "${raw}"`;

    for (const itemNo of matchedItemNos) {
      const tagProduct = await MasterLoader.lookupByItemNo(itemNo);
      if (!tagProduct) continue;
      const itemImages = await ProductDB.getImagesByItemNo(itemNo);
      const thumbUrl = itemImages.length ? URL.createObjectURL(itemImages[0].imageBlob) : "";
      renderResultCard(els.tagExactResult, tagProduct, "ตรงกับ Tag", "result-exact", thumbUrl, itemImages);
    }
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
