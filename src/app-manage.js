// app-manage.js
// Wires the "Manage data" page: view every stored photo grouped by product,
// delete a single photo, delete all photos of one product, or wipe everything.

const manageStatus = document.getElementById("manageStatus");
const productGroups = document.getElementById("productGroups");
const clearAllBtn = document.getElementById("clearAllBtn");

async function renderGroups() {
  productGroups.innerHTML = "";

  const all = await ProductDB.getAllImageRecords();
  if (all.length === 0) {
    productGroups.innerHTML = '<div class="status-text">ยังไม่มีข้อมูลในฐานข้อมูล</div>';
    return;
  }

  const groups = new Map(); // itemNo -> records[]
  for (const r of all) {
    if (!groups.has(r.itemNo)) groups.set(r.itemNo, []);
    groups.get(r.itemNo).push(r);
  }

  for (const [itemNo, records] of groups) {
    const product = await MasterLoader.lookupByItemNo(itemNo);

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = product
      ? `${product.description} (Item No: ${itemNo})`
      : `Item No: ${itemNo} (ไม่พบใน master data)`;
    card.appendChild(title);

    if (records[0].tags && records[0].tags.length) {
      const tagsLine = document.createElement("div");
      tagsLine.className = "result-meta";
      tagsLine.textContent = "Tags: " + records[0].tags.join(", ");
      card.appendChild(tagsLine);
    }

    const thumbs = document.createElement("div");
    thumbs.className = "batch-thumbs";
    for (const r of records) {
      const thumbWrap = document.createElement("div");
      thumbWrap.className = "thumb-wrap";

      const img = document.createElement("img");
      img.src = URL.createObjectURL(r.imageBlob);
      thumbWrap.appendChild(img);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "thumb-delete-btn";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", async () => {
        try {
          await ProductDB.deleteRecord(r.id);
          manageStatus.textContent = "ลบรูปแล้ว";
          await renderGroups();
        } catch (err) {
          manageStatus.textContent = "ลบไม่สำเร็จ: " + err.message;
        }
      });
      thumbWrap.appendChild(delBtn);

      thumbs.appendChild(thumbWrap);
    }
    card.appendChild(thumbs);

    const delAllBtn = document.createElement("button");
    delAllBtn.type = "button";
    delAllBtn.className = "btn-danger";
    delAllBtn.style.marginTop = "10px";
    delAllBtn.style.width = "100%";
    delAllBtn.textContent = `🗑️ ลบสินค้านี้ทั้งหมด (${records.length} รูป)`;
    delAllBtn.addEventListener("click", async () => {
      try {
        await ProductDB.deleteByItemNo(itemNo);
        manageStatus.textContent = `ลบ ${itemNo} เรียบร้อย`;
        await renderGroups();
      } catch (err) {
        manageStatus.textContent = "ลบไม่สำเร็จ: " + err.message;
      }
    });
    card.appendChild(delAllBtn);

    productGroups.appendChild(card);
  }
}

clearAllBtn.addEventListener("click", async () => {
  if (!confirm("ยืนยันลบข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถกู้คืนได้")) return;
  try {
    await ProductDB.clearAll();
    manageStatus.textContent = "ล้างฐานข้อมูลทั้งหมดแล้ว";
    await renderGroups();
  } catch (err) {
    manageStatus.textContent = "ลบไม่สำเร็จ: " + err.message;
  }
});

(async function init() {
  try {
    manageStatus.textContent = "กำลังโหลดข้อมูล...";
    await MasterLoader.loadMasterData();
    await renderGroups();
    manageStatus.textContent = "";
  } catch (err) {
    console.error(err);
    manageStatus.textContent = "โหลดไม่สำเร็จ: " + err.message;
  }
})();
