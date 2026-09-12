import { loadMobileNet } from './vision.js';
import { searchByImage } from './search.js';
import { getAllProducts } from './db.js';

const cameraSearchFile = document.getElementById('camera-search-file');
const gallerySearchFile = document.getElementById('gallery-search-file');
const previewWrapper = document.getElementById('preview-wrapper');
const imagePreview = document.getElementById('image-preview');
const btnSearchImage = document.getElementById('btn-search-image');
const searchImageStatus = document.getElementById('search-image-status');

const barcodeTagInput = document.getElementById('barcode-tag-input');
const btnSearchText = document.getElementById('btn-search-text');
const searchTextStatus = document.getElementById('search-text-status');
const statusCard = document.getElementById('status-card');
const statusText = document.getElementById('status-text');
const resultsContainer = document.getElementById('results-container');

// Modal Elements
const galleryModal = document.getElementById('gallery-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalProductName = document.getElementById('modal-product-name');
const modalProductTags = document.getElementById('modal-product-tags');
const modalImagesGrid = document.getElementById('modal-images-grid');

let currentFile = null;

function handleImageFile(file) {
    if (!file) return;
    currentFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        previewWrapper.style.display = 'block';
        searchImageStatus.textContent = 'เลือกรูปแล้ว กดปุ่ม "ค้นหาสินค้าจากรูป" เพื่อเริ่มค้นหา';
        resultsContainer.innerHTML = '';
    };
    reader.readAsDataURL(file);
}

// 1. ถ่ายจากกล้อง
cameraSearchFile.addEventListener('change', (e) => {
    handleImageFile(e.target.files[0]);
    e.target.value = '';
});

// 2. เลือกจากคลังรูปภาพ
gallerySearchFile.addEventListener('change', (e) => {
    handleImageFile(e.target.files[0]);
    e.target.value = '';
});

// กดค้นหาจากรูปภาพ
btnSearchImage.addEventListener('click', async () => {
    if (!currentFile || !imagePreview.src) {
        alert('กรุณาถ่ายรูปหรือเลือกรูปภาพก่อนค้นหา');
        return;
    }

    statusCard.style.display = 'flex';
    statusText.textContent = 'กำลังค้นหาสินค้าที่คล้ายกัน...';
    btnSearchImage.disabled = true;
    resultsContainer.innerHTML = '';

    try {
        await loadMobileNet();
        await new Promise(r => {
            if (imagePreview.complete) r();
            else imagePreview.onload = r;
        });

        const results = await searchByImage(imagePreview);
        renderResults(results);
        searchImageStatus.textContent = `พบสินค้าตรงกัน และสินค้าใกล้เคียง ${results.length} รายการ`;
    } catch (err) {
        console.error(err);
        searchImageStatus.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
    } finally {
        statusCard.style.display = 'none';
        btnSearchImage.disabled = false;
    }
});

// กดค้นหาด้วย Barcode หรือ Tag
btnSearchText.addEventListener('click', async () => {
    const query = barcodeTagInput.value.trim().toLowerCase();
    if (!query) {
        alert('กรุณากรอก Barcode หรือ Tag');
        return;
    }

    statusCard.style.display = 'flex';
    statusText.textContent = 'กำลังค้นหาจาก Barcode / Tag...';
    btnSearchText.disabled = true;
    resultsContainer.innerHTML = '';

    try {
        const allProducts = await getAllProducts();
        const matched = allProducts.filter((p) => {
            const barcodeMatch = (p.barcode && String(p.barcode).toLowerCase().includes(query));
            const itemNoMatch = (p.itemNo && String(p.itemNo).toLowerCase().includes(query));
            const nameMatch = (p.name && p.name.toLowerCase().includes(query));
            const tagsMatch = (Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(query)));
            return barcodeMatch || itemNoMatch || nameMatch || tagsMatch;
        });

        renderResults(matched.map(p => ({ product: p, matchType: 'exact' })));
        searchTextStatus.textContent = `พบสินค้าตรงกัน และสินค้าใกล้เคียง ${matched.length} รายการ`;
    } catch (err) {
        console.error(err);
        searchTextStatus.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
    } finally {
        statusCard.style.display = 'none';
        btnSearchText.disabled = false;
    }
});

function renderResults(results) {
    resultsContainer.innerHTML = '';
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div class="card" style="text-align: center; color: #64748b;">ไม่พบสินค้าที่ตรงกัน</div>';
        return;
    }

    results.forEach(item => {
        const p = item.product || item;
        const images = (p.images && p.images.length > 0) ? p.images : (p.image ? [p.image] : []);
        const coverImage = images[0] || 'img/placeholder.png';
        const tags = p.tags || [];

        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.gap = '12px';
        card.style.alignItems = 'flex-start';
        card.style.marginBottom = '12px';

        let badgeText = 'สินค้าใกล้เคียง';
        let badgeColor = '#3b82f6';
        if (item.matchType === 'exact' || item.method === 'barcode') {
            badgeText = 'ตรงกับ Barcode/Tag';
            badgeColor = '#10b981';
        } else if (item.similarity !== undefined) {
            badgeText = `${(item.similarity * 100).toFixed(1)}% ใกล้เคียง`;
        }

        card.innerHTML = `
            <img src="${coverImage}" alt="${p.name || ''}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; flex-shrink: 0;">
            <div style="flex: 1; min-width: 0;">
                <span style="font-size: 0.8rem; color: ${badgeColor}; font-weight: 600;">${badgeText}</span>
                <h4 style="margin: 2px 0 4px 0; font-size: 0.95rem; color: #1e293b; line-height: 1.3;">${p.name || '-'}</h4>
                <div style="font-size: 0.8rem; color: #64748b; line-height: 1.4;">
                    ${p.itemNo ? `Item No: ${p.itemNo} • ` : ''}ราคา: ${p.price || '-'}<br>
                    Barcode: ${p.barcode || '-'}
                </div>
                ${tags.length > 0 ? `<div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">${tags.map(t => `<span style="font-size: 0.75rem; background: #f1f5f9; padding: 1px 6px; border-radius: 4px; color: #475569;">#${t}</span>`).join('')}</div>` : ''}
                <button type="button" class="btn-view-gallery" style="margin-top: 8px; background: transparent; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; font-size: 0.8rem; cursor: pointer; color: #2563eb;">
                    🖼️ ดูรูปภาพอื่นๆ (${images.length} รูป)
                </button>
            </div>
        `;

        card.querySelector('.btn-view-gallery').onclick = () => openGalleryModal(p, images);
        resultsContainer.appendChild(card);
    });
}

function openGalleryModal(product, images) {
    modalProductName.textContent = product.name || 'รูปภาพสินค้า';
    modalProductTags.innerHTML = '';
    if (product.tags && product.tags.length > 0) {
        modalProductTags.innerHTML = product.tags.map(t => `<span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; color: #475569;">#${t}</span>`).join('');
    }

    modalImagesGrid.innerHTML = '';
    images.forEach(imgSrc => {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.width = '100%';
        img.style.height = '100px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '6px';
        img.style.border = '1px solid #e2e8f0';
        modalImagesGrid.appendChild(img);
    });

    galleryModal.style.display = 'flex';
}

btnCloseModal.onclick = () => { galleryModal.style.display = 'none'; };
window.onclick = (e) => { if (e.target === galleryModal) galleryModal.style.display = 'none'; };
