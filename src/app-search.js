// app-search.js
// Wires the "Search" page: search by photo (top 5 similar), and search by
// Barcode/Tag (exact product + 3-5 visually similar products).

const els = {
  photoInput: document.getElementById("photoInput"),
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
};

let searchFiles = [];

function setStatus(msg) {
  els.status.textContent = msg;
}

/**
 * Renders one result card. `badge` is the small colored label
 * (e.g. "94.2% ตรงกัน" or "ตรงกับ Barcode/Tag").
 */
function renderResultCard(container, product, badgeText, badgeClass, thumbUrl) {
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
  container.appendChild(card);
}

// ---------- Search by photo ----------

els.photoInput.addEventListener("change", () => {
  searchFiles = Array.from(els.photoInput.files);
  els.photoThumbs.innerHTML = "";
  for (const file of searchFiles) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    els.photoThumbs.appendChild(img);
  }
  els.photoResults.innerHTML = "";
  setStatus(
    searchFiles.length
      ? `เลือกไว้ ${searchFiles.length} รูป พร้อมค้นหา`
      : "กรุณาเลือกรูปอย่างน้อย 1 รูป"
  );
});

els.searchBtn.addEventListener("click", async () => {
  if (searchFiles.length === 0) {
    setStatus("กรุณาเลือกรูปอย่างน้อย 1 รูป");
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

    setStatus(`พบ ${matches.length} รายการที่ใกล้เคียงที่สุด (จากรูป ${searchFiles.length} รูปที่เลือก)`);
  } catch (err) {
    console.error(err);
    setStatus("เกิดข้อผิดพลาดระหว่างค้นหา: " + err.message);
  }
});

// ---------- Search by Barcode / Tag ----------

els.tagSearchBtn.addEventListener("click", async () => {
  const raw = els.tagInput.value.trim();
  els.tagExactResult.innerHTML = "";
  els.similarResults.innerHTML = "";
  els.similarWrap.style.display = "none";

  if (!raw) {
    els.tagStatus.textContent = "กรุณากรอก Barcode หรือ Item No / Tag";
    return;
  }

  try {
    els.tagStatus.textContent = "กำลังค้นหา...";

    // Try as a barcode first, then fall back to treating it as an itemNo/tag.
    let product = await MasterLoader.lookupByBarcode(raw);
    if (!product) {
      product = await MasterLoader.lookupByItemNo(raw);
    }

    if (!product) {
      els.tagStatus.textContent = `ไม่พบสินค้า: ${raw}`;
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
