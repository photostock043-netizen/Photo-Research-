import { searchByImage } from './search.js';
import { getAllProducts } from './db.js';

const cameraSearchInput = document.getElementById('cameraSearchInput');
const gallerySearchInput = document.getElementById('gallerySearchInput');
const previewBox = document.getElementById('previewBox');
const previewImg = document.getElementById('searchPreviewImg');
const statusMessage = document.getElementById('statusMessage');
const resultsContainer = document.getElementById('resultsContainer');

const imageModal = document.getElementById('imageModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTitle = document.getElementById('modalTitle');
const modalTags = document.getElementById('modalTags');
const modalImages = document.getElementById('modalImages');

// รับไฟล์ภาพไม่ว่าจะมาจากกล้องหรือคลัง
async function onFileSelected(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    previewImg.src = e.target.result;
    previewBox.style.display = 'block';
    statusMessage.textContent = 'กำลังค้นหา...';
    resultsContainer.innerHTML = '';

    await new Promise(res => previewImg.onload = res);

    try {
      // เรียกฟังก์ชันค้นหาเดิมของโปรเจกต์
      const results = await searchByImage(previewImg);
      displayResults(results);
    } catch (err) {
      console.error(err);
      statusMessage.textContent = 'เกิดข้อผิดพลาดในการค้นหา: ' + err.message;
    }
  };
  reader.readAsDataURL(file);
}

// 1. ค้นหา: ถ่ายจากกล้อง
cameraSearchInput.addEventListener('change', (e) => {
  onFileSelected(e.target.files[0]);
  e.target.value = '';
});

// 2. ค้นหา: เลือกจากคลัง
gallerySearchInput.addEventListener('change', (e) => {
  onFileSelected(e.target.files[0]);
  e.target.value = '';
});

function displayResults(results) {
  if (!results || results.length === 0) {
    statusMessage.textContent = 'ไม่พบสินค้าที่ใกล้เคียง';
    return;
  }

  statusMessage.textContent = `พบสินค้า ${results.length} รายการ:`;

  results.forEach(item => {
    const p = item.product || item;
    const card = document.createElement('div');
    card.style.border = '1px solid #ddd';
    card.style.borderRadius = '6px';
    card.style.padding = '10px';
    card.style.marginBottom = '10px';
    card.style.display = 'flex';
    card.style.gap = '15px';
    card.style.alignItems = 'center';

    const allImages = p.images && p.images.length > 0 ? p.images : (p.image ? [p.image] : []);
    const coverSrc = allImages[0] || '';

    const imgEl = document.createElement('img');
    imgEl.src = coverSrc;
    imgEl.style.width = '80px';
    imgEl.style.height = '80px';
    imgEl.style.objectFit = 'cover';
    imgEl.style.borderRadius = '4px';

    const info = document.createElement('div');
    info.style.flex = '1';
    
    let tagsHtml = '';
    if (p.tags && p.tags.length > 0) {
      tagsHtml = `<div style="margin: 4px 0;">${p.tags.map(t => `<span style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-right: 4px;">#${t}</span>`).join('')}</div>`;
    }

    info.innerHTML = `
      <h3 style="margin: 0 0 5px 0;">${p.name}</h3>
      <p style="margin: 0 0 5px 0; color: #666;">บาร์โค้ด: ${p.barcode}</p>
      ${tagsHtml}
    `;

    // ปุ่มกดเข้าไปดูรูปภาพอื่นๆ
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.textContent = `ดูรูปภาพ (${allImages.length})`;
    viewBtn.style.padding = '6px 10px';
    viewBtn.style.cursor = 'pointer';
    viewBtn.onclick = () => showImageModal(p, allImages);

    info.appendChild(viewBtn);

    card.appendChild(imgEl);
    card.appendChild(info);
    resultsContainer.appendChild(card);
  });
}

// แสดง Pop-up ดูรูปภาพทั้งหมดของสินค้า
function showImageModal(product, images) {
  modalTitle.textContent = product.name;
  modalTags.textContent = product.tags && product.tags.length > 0 ? 'Tags: ' + product.tags.join(', ') : '';
  modalImages.innerHTML = '';

  images.forEach(src => {
    const img = document.createElement('img');
    img.src = src;
    img.style.width = '100px';
    img.style.height = '100px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '4px';
    img.style.border = '1px solid #ccc';
    modalImages.appendChild(img);
  });

  imageModal.style.display = 'flex';
}

closeModalBtn.onclick = () => {
  imageModal.style.display = 'none';
};

window.onclick = (e) => {
  if (e.target === imageModal) {
    imageModal.style.display = 'none';
  }
};
