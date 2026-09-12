import { loadMobileNet } from './vision.js';
import { searchByImage } from './search.js';

const cameraSearchFile = document.getElementById('camera-search-file');
const gallerySearchFile = document.getElementById('gallery-search-file');
const previewWrapper = document.getElementById('preview-wrapper');
const imagePreview = document.getElementById('image-preview');
const startSearchBtn = document.getElementById('start-search-btn');
const statusCard = document.getElementById('status-card');
const statusText = document.getElementById('status-text');
const resultsContainer = document.getElementById('resultsContainer') || document.getElementById('results-container');

// Modal Elements
const imageModal = document.getElementById('image-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalProductTitle = document.getElementById('modal-product-title');
const modalTags = document.getElementById('modal-tags');
const modalImagesGrid = document.getElementById('modal-images-grid');

let currentFile = null;

function onImageReady(file) {
    if (!file) return;
    currentFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        previewWrapper.style.display = 'block';
        startSearchBtn.style.display = 'block'; // แสดงปุ่มให้กดค้นหา
        resultsContainer.innerHTML = '';
    };
    reader.readAsDataURL(file);
}

// 1. ถ่ายจากกล้อง
cameraSearchFile.addEventListener('change', (e) => {
    onImageReady(e.target.files[0]);
    e.target.value = '';
});

// 2. เลือกจากคลังรูป
gallerySearchFile.addEventListener('change', (e) => {
    onImageReady(e.target.files[0]);
    e.target.value = '';
});

// เมื่อกดปุ่ม "เริ่มค้นหา"
startSearchBtn.addEventListener('click', async () => {
    if (!currentFile || !imagePreview.src) {
        alert('กรุณาถ่ายภาพหรือเลือกภาพก่อนค้นหา');
        return;
    }

    statusCard.style.display = 'flex';
    statusText.textContent = 'กำลังค้นหาสินค้าด้วย AI และบาร์โค้ด...';
    startSearchBtn.disabled = true;
    resultsContainer.innerHTML = '';

    try {
        await loadMobileNet();
        await new Promise(r => {
            if (imagePreview.complete) r();
            else imagePreview.onload = r;
        });

        // เรียกค้นหาผ่านระบบ search.js เดิมของโปรเจกต์
        const results = await searchByImage(imagePreview);
        renderResults(results);
    } catch (err) {
        console.error(err);
        statusText.textContent = 'เกิดข้อผิดพลาดในการค้นหา: ' + err.message;
    } finally {
        statusCard.style.display = 'none';
        startSearchBtn.disabled = false;
    }
});

function renderResults(results) {
    resultsContainer.innerHTML = '';

    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div class="card"><p style="text-align: center;">ไม่พบสินค้าที่ตรงกัน</p></div>';
        return;
    }

    results.forEach(res => {
        const p = res.product || res;
        const allImages = (p.images && p.images.length > 0) ? p.images : (p.image ? [p.image] : []);
        const coverImage = allImages[0] || '';
        const tags = p.tags || [];

        const card = document.createElement('div');
        card.className = 'card result-card';

        let scoreBadge = '';
        if (res.method === 'barcode') {
            scoreBadge = `<span class="badge" style="background: var(--success-color, #10b981);">บาร์โค้ดตรงกัน (100%)</span>`;
        } else if (res.similarity !== undefined) {
            scoreBadge = `<span class="badge">ความคล้ายคลึง: ${(res.similarity * 100).toFixed(1)}%</span>`;
        }

        let tagsHtml = '';
        if (tags.length > 0) {
            tagsHtml = `<div style="margin-top: 6px;">${tags.map(t => `<span class="badge" style="background: #e2e8f0; color: #334155; margin-right: 4px;">#${t}</span>`).join('')}</div>`;
        }

        card.innerHTML = `
            <div style="display: flex; gap: 15px; align-items: center;">
                <img src="${coverImage}" alt="${p.name}" style="width: 90px; height: 90px; object-fit: cover; border-radius: var(--radius, 6px); border: 1px solid #ddd;">
                <div style="flex: 1;">
                    <div class="result-header" style="margin-bottom: 5px;">
                        <h3 style="margin: 0;">${p.name}</h3>
                        ${scoreBadge}
                    </div>
                    <p style="margin: 0; color: #64748b;">รหัสบาร์โค้ด: ${p.barcode}</p>
                    ${tagsHtml}
                    <div style="margin-top: 8px;">
                        <button type="button" class="btn btn-secondary view-gallery-btn" style="padding: 4px 10px; font-size: 0.85rem;">
                            🖼️ ดูรูปภาพอื่นๆ (${allImages.length} รูป)
                        </button>
                    </div>
                </div>
            </div>
        `;

        card.querySelector('.view-gallery-btn').onclick = () => openImageModal(p, allImages);
        resultsContainer.appendChild(card);
    });
}

// ฟังก์ชันเปิด Modal เพื่อดูรูปภาพอื่นๆ ของสินค้า
function openImageModal(product, images) {
    modalProductTitle.textContent = product.name || 'รูปภาพสินค้า';
    
    modalTags.innerHTML = '';
    if (product.tags && product.tags.length > 0) {
        modalTags.innerHTML = product.tags.map(t => `<span class="badge" style="background: #e2e8f0; color: #334155; margin-right: 4px;">#${t}</span>`).join('');
    }

    modalImagesGrid.innerHTML = '';
    images.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        img.style.width = '120px';
        img.style.height = '120px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = 'var(--radius, 6px)';
        img.style.border = '1px solid #ddd';
        modalImagesGrid.appendChild(img);
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
