import { loadMobileNet, extractFeatures } from './vision.js';
import { saveProduct, getProductByBarcode } from './db.js';

let selectedImages = [];
let barcodeIndexMap = {};

const barcodeInput = document.getElementById('barcode');
const tagsInput = document.getElementById('tags');
const lookupNameEl = document.getElementById('product-lookup-name');
const cameraFile = document.getElementById('camera-file');
const galleryFile = document.getElementById('gallery-file');
const previewList = document.getElementById('image-preview-list');
const form = document.getElementById('add-product-form');
const statusCard = document.getElementById('status-card');
const statusText = document.getElementById('status-text');
const submitBtn = document.getElementById('submit-btn');

// โหลดฐานข้อมูลบาร์โค้ดเดิมในระบบเพื่อดึงชื่ออัตโนมัติ
async function initBarcodeDatabase() {
    try {
        const res = await fetch('barcodeIndex.json');
        if (res.ok) {
            barcodeIndexMap = await res.json();
        }
    } catch (e) {
        console.warn('barcodeIndex.json lookup error:', e);
    }
}
initBarcodeDatabase();

// ตรวจสอบชื่อสินค้าให้อัตโนมัติเมื่อพิมพ์ Barcode
barcodeInput.addEventListener('input', async () => {
    const code = barcodeInput.value.trim();
    if (!code) {
        lookupNameEl.textContent = '';
        return;
    }

    const existing = await getProductByBarcode(code);
    if (existing && existing.name) {
        lookupNameEl.textContent = `✓ พบในฐานข้อมูล: ${existing.name}`;
        return;
    }

    if (barcodeIndexMap[code]) {
        const p = barcodeIndexMap[code];
        lookupNameEl.textContent = `✓ พบในระบบ: ${p.name || p.title || p}`;
        return;
    }

    lookupNameEl.textContent = `(ไม่พบชื่อสินค้าเดิม จะใช้รหัสเป็นชื่อสินค้า)`;
});

function appendImages(files) {
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedImages.push(e.target.result);
            renderPreviews();
        };
        reader.readAsDataURL(file);
    });
}

function renderPreviews() {
    previewList.innerHTML = '';
    selectedImages.forEach((src, idx) => {
        const item = document.createElement('div');
        item.style.position = 'relative';
        item.style.display = 'inline-block';

        const img = document.createElement('img');
        img.src = src;
        img.style.width = '70px';
        img.style.height = '70px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = 'var(--radius, 6px)';
        img.style.border = '1px solid #ddd';

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.innerHTML = '&times;';
        delBtn.style.position = 'absolute';
        delBtn.style.top = '-5px';
        delBtn.style.right = '-5px';
        delBtn.style.background = '#ef4444';
        delBtn.style.color = '#fff';
        delBtn.style.border = 'none';
        delBtn.style.borderRadius = '50%';
        delBtn.style.width = '18px';
        delBtn.style.height = '18px';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontSize = '12px';
        delBtn.onclick = () => {
            selectedImages.splice(idx, 1);
            renderPreviews();
        };

        item.appendChild(img);
        item.appendChild(delBtn);
        previewList.appendChild(item);
    });
}

// 1. ถ่ายจากกล้อง (ถ่ายเพิ่มทีละรูปได้เรื่อยๆ)
cameraFile.addEventListener('change', (e) => {
    appendImages(e.target.files);
    e.target.value = '';
});

// 2. เลือกจากคลัง (เลือกทีละหลายๆ รูปพร้อมกันได้)
galleryFile.addEventListener('change', (e) => {
    appendImages(e.target.files);
    e.target.value = '';
});

// บันทึกสินค้า
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (selectedImages.length === 0) {
        alert('กรุณาถ่ายรูปหรือเลือกรูปภาพอย่างน้อย 1 รูป');
        return;
    }

    const barcode = barcodeInput.value.trim();
    const rawTags = tagsInput.value.trim();
    const tags = rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : [];

    // ดึงชื่อและข้อมูลจากฐานข้อมูลเดิมอัตโนมัติ
    let name = barcode;
    let itemNo = barcode;
    let price = '-';

    const existing = await getProductByBarcode(barcode);
    if (existing) {
        name = existing.name || name;
        itemNo = existing.itemNo || itemNo;
        price = existing.price || price;
    } else if (barcodeIndexMap[barcode]) {
        const meta = barcodeIndexMap[barcode];
        name = meta.name || meta.title || name;
        itemNo = meta.itemNo || itemNo;
        price = meta.price || price;
    }

    statusCard.style.display = 'flex';
    submitBtn.disabled = true;
    statusText.textContent = 'กำลังโหลดโมเดล AI และวิเคราะห์รูปภาพ...';

    try {
        await loadMobileNet();

        const tempImg = new Image();
        tempImg.src = selectedImages[0];
        await new Promise(r => tempImg.onload = r);

        statusText.textContent = 'กำลังแปลงภาพเป็น Vector...';
        const features = await extractFeatures(tempImg);

        let finalImages = [...selectedImages];
        if (existing && Array.isArray(existing.images)) {
            finalImages = [...existing.images, ...selectedImages];
        }

        const productData = {
            barcode,
            name,
            itemNo,
            price,
            image: finalImages[0], // โครงสร้างเดิมสำหรับรูปปก
            images: finalImages,   // รูปภาพทั้งหมด
            tags,                  // Tags
            features: Array.from(features)
        };

        statusText.textContent = 'กำลังบันทึกลงฐานข้อมูล...';
        await saveProduct(productData);

        alert(`บันทึกสินค้า "${name}" สำเร็จเรียบร้อยแล้ว`);
        form.reset();
        lookupNameEl.textContent = '';
        selectedImages = [];
        renderPreviews();
    } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
        statusCard.style.display = 'none';
        submitBtn.disabled = false;
    }
});
