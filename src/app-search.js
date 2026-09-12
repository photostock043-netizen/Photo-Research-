import { extractFeatures, extractBarcode } from './vision.js';
import { searchByFeatures, searchByBarcode, getAllProducts } from './search.js';

const cameraSearchInput = document.getElementById('cameraSearchInput');
const gallerySearchInput = document.getElementById('gallerySearchInput');
const searchPreview = document.getElementById('searchPreview');
const queryImage = document.getElementById('queryImage');
const loadingStatus = document.getElementById('loadingStatus');
const resultsSection = document.getElementById('resultsSection');

// Modal Elements
const galleryModal = document.getElementById('galleryModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalProductName = document.getElementById('modalProductName');
const modalTags = document.getElementById('modalTags');
const modalImagesContainer = document.getElementById('modalImagesContainer');

let loadedProductsCache = [];

async function handleSearch(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    queryImage.src = e.target.result;
    searchPreview.style.display = 'block';
    loadingStatus.style.display = 'block';
    resultsSection.innerHTML = '';

    await new Promise(r => queryImage.onload = r);

    try {
      // 1. ตรวจสอบบาร์โค้ด
      let barcode = null;
      try {
        barcode = await extractBarcode(queryImage);
      } catch (err) {
        console.log('No barcode found');
      }

      let results = [];
      if (barcode) {
        results = await searchByBarcode(barcode);
      }

      // 2. ถ้าไม่เจอบาร์โค้ด ให้ค้นหาด้วย Visual Features
      if (!results || results.length === 0) {
        const queryVector = await extractFeatures(queryImage);
        results = await searchByFeatures(queryVector);
      }

      loadedProductsCache = results;
      renderResults(results);
    } catch (err) {
      console.error(err);
      resultsSection.innerHTML = `<p class="status-msg error">เกิดข้อผิดพลาดในการค้นหา: ${err.message}</p>`;
    } finally {
      loadingStatus.style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
}

// 1. ค้นหาผ่านกล้อง
cameraSearchInput.addEventListener('change', (e) => {
  handleSearch(e.target.files[0]);
  e.target.value = '';
});

// 2. ค้นหาผ่านคลังรูป
gallerySearchInput.addEventListener('change', (e) => {
  handleSearch(e.target.files[0]);
  e.target.value = '';
});

function renderResults(products) {
  resultsSection.innerHTML = '';

  if (!products || products.length === 0) {
    resultsSection.innerHTML = '<p class="status-msg">ไม่พบสินค้าที่ตรงกัน</p>';
    return;
  }

  products.forEach((prod, index) => {
    const card = document.createElement('div');
    card.className = 'result-card card';

    // รองรับทั้ง schema เก่า (image) และ schema ใหม่ (images[])
    const imagesList = prod.images || (prod.image ? [prod.image] : []);
    const coverImage = imagesList[0] || 'placeholder.png';
    const tagList = prod.tags || [];

    card.innerHTML = `
      <img src="${coverImage}" alt="${prod.name}" class="result-thumb">
      <div class="result-info">
        <h3>${prod.name}</h3>
        <p><strong>บาร์โค้ด:</strong> ${prod.barcode || '-'}</p>
        ${prod.similarity !== undefined ? `<p><strong>ความคล้ายคลึง:</strong> ${(prod.similarity * 100).toFixed(1)}%</p>` : ''}
        ${tagList.length > 0 ? `<div class="tag-chips">${tagList.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
        <button type="button" class="btn btn-secondary view-more-btn" data-index="${index}">
          🖼️ ดูรูปภาพทั้งหมด (${imagesList.length})
        </button>
      </div>
    `;

    card.querySelector('.view-more-btn').onclick = () => openModal(prod);
    resultsSection.appendChild(card);
  });
}

// ฟังก์ชันเปิด Modal ดูรูปทั้งหมด
function openModal(prod) {
  const imagesList = prod.images || (prod.image ? [prod.image] : []);
  modalProductName.textContent = prod.name || 'รูปภาพสินค้า';
  
  // Render Tags ใน Modal
  modalTags.innerHTML = '';
  if (prod.tags && prod.tags.length > 0) {
    prod.tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = tag;
      modalTags.appendChild(chip);
    });
  }

  // Render รูปภาพทั้งหมด
  modalImagesContainer.innerHTML = '';
  imagesList.forEach((src) => {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'modal-img-item';
    modalImagesContainer.appendChild(img);
  });

  galleryModal.style.display = 'flex';
}

closeModalBtn.onclick = () => {
  galleryModal.style.display = 'none';
};

window.onclick = (e) => {
  if (e.target === galleryModal) {
    galleryModal.style.display = 'none';
  }
};
