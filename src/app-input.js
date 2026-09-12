import { loadMobileNet, extractFeatures } from './vision.js';
import { saveProduct, getProductByBarcode } from './db.js';

let selectedImages = []; // เก็บ Data URL ของรูปทั้งหมด

const barcodeInput = document.getElementById('barcodeInput') || document.getElementById('barcode');
const tagsInput = document.getElementById('tagsInput') || document.getElementById('tags');
const lookupNameEl = document.getElementById('product-lookup-name');
const cameraFile = document.getElementById('camera-file');
const galleryFile = document.getElementById('gallery-file');
const previewList = document.getElementById('image-preview-list');
const form = document.getElementById('add-product-form');
const statusCard = document.getElementById('status-card');
const statusText = document.getElementById('status-text');
const submitBtn = document.getElementById('submit-btn');

let barcodeIndexMap = {};

// โหลดฐานข้อมูลบาร์โค้ดที่มีอยู่แล้วในระบบเพื่อค้นหาชื่อสินค้าอัตโนมัติ
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

// ตรวจสอบชื่อสินค้าอัตโนมัติเมื่อพิมพ์บาร์โค้ด
barcodeInput.addEventListener('input', async () => {
    const code = barcodeInput.value.trim();
    if (!code) {
        lookupNameEl.textContent = '';
        return;
    }

    // 1. ตรวจสอบจาก IndexedDB
    const existing = await getProductByBarcode(code);
    if (existing && existing.name) {
        lookupNameEl.textContent = `✓ พบในฐานข้อมูล: ${existing.name}`;
        return;
    }

    // 2. ตรวจสอบจาก barcodeIndex.json ของระบบ
    if (barcodeIndexMap[code]) {
        const p = barcodeIndexMap[code];
        lookupNameEl.textContent = `✓ พบในระบบ: ${p.name || p.title || p}`;
        return;
    }

    lookupNameEl.textContent = `(ไม่พบชื่อสินค้าเดิมในฐานข้อมูล จะใช้รหัสบาร์โค้ดเป็นชื่อ)`;
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
        item.style.margin = '4px';

        const img = document.createElement('img');
        img.src = src;
        img.style.width = '80px';
        img.style.height = '80px';
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
        delBtn.style.width = '20px';
        delBtn.style.height = '20px';
        delBtn.style.cursor = 'pointer';
        delBtn.onclick = () => {
            selectedImages.splice(idx, 1);
            renderPreviews();
        };

        item.appendChild(img);
        item.appendChild(delBtn);
        previewList.appendChild(item);
    });
}

// 1. ถ่ายจากกล้อง (ถ่ายทีละรูปแล้วนำมาต่อท้ายสะสมเรื่อยๆ)
cameraFile.addEventListener('change', (e) => {
    appendImages(e.target.files);
    e.target.value = '';
});

// 2. เลือกจากคลัง (เลือกทีละหลายๆ รูปพร้อมกัน)
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

    // ประมวลผล Tags (ไม่บังคับ)
    const tags = rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : [];

    // ดึงชื่อสินค้าจากระบบฐานข้อมูลเดิม
    let name = barcode;
    const existing = await getProductByBarcode(barcode);
    if (existing && existing.name) {
        name = existing.name;
    } else if (barcodeIndexMap[barcode]) {
        const p = barcodeIndexMap[barcode];
        name = p.name || p.title || p;
    }

    statusCard.style.display = 'flex';
    submitBtn.disabled = true;
    statusText.textContent = 'กำลังโหลดโมเดล AI และวิเคราะห์คุณลักษณะรูปภาพ...';

    try {
        await loadMobileNet();

        // สกัด Features Vector จากภาพแรกของสินค้า
        const tempImg = new Image();
        tempImg.src = selectedImages[0];
        await new Promise(r => tempImg.onload = r);

        statusText.textContent = 'กำลังแปลงภาพเป็น Vector...';
        const features = await extractFeatures(tempImg);

        // รวมรูปภาพเดิมที่มีอยู่แล้ว (ถ้ามี) เข้ากับรูปใหม่
        let allImages = [...selectedImages];
        if (existing && existing.images && Array.isArray(existing.images)) {
            allImages = [...existing.images, ...selectedImages];
        }

        const productData = {
            barcode,
            name,
            image: allImages[0],      // รองรับโครงสร้างรูปหลักเดิม
            images: allImages,        // รองรับหลายรูป
            tags,                     // Tags ป้ายกำกับ
            features: Array.from(features)
        };

        statusText.textContent = 'กำลังบันทึกลงฐานข้อมูล...';
        await saveProduct(productData);

        alert(`บันทึกสินค้า "${name}" สำเร็จ เรียบร้อยแล้ว`);
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
