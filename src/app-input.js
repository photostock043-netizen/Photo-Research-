import { addProduct } from './db.js';
import { extractFeatures, extractBarcode } from './vision.js';

let selectedImages = []; // เก็บ DataURL ของรูปภาพทั้งหมด

const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');
const previewContainer = document.getElementById('previewContainer');
const productForm = document.getElementById('productForm');
const saveBtn = document.getElementById('saveBtn');

function processFiles(files) {
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
  previewContainer.innerHTML = '';
  selectedImages.forEach((imgSrc, index) => {
    const item = document.createElement('div');
    item.className = 'preview-item';

    const img = document.createElement('img');
    img.src = imgSrc;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-delete';
    delBtn.innerHTML = '&times;';
    delBtn.onclick = () => {
      selectedImages.splice(index, 1);
      renderPreviews();
    };

    item.appendChild(img);
    item.appendChild(delBtn);
    previewContainer.appendChild(item);
  });
}

// 1. ถ่ายจากกล้อง (ถ่ายสะสมได้เรื่อยๆ)
cameraInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    processFiles(e.target.files);
    e.target.value = '';
  }
});

// 2. เลือกจากคลัง (เลือกพร้อมกันได้หลายรูป)
galleryInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    processFiles(e.target.files);
    e.target.value = '';
  }
});

// บันทึกสินค้า
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (selectedImages.length === 0) {
    alert('กรุณาถ่ายรูปหรือเลือกรูปภาพอย่างน้อย 1 รูป');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'กำลังประมวลผลเวกเตอร์และบันทึก...';

  try {
    const name = document.getElementById('nameInput').value.trim();
    let barcode = document.getElementById('barcodeInput').value.trim();
    const rawTags = document.getElementById('tagsInput').value.trim();

    // ประมวลผล Tags (แยกด้วย comma และตัดช่องว่าง)
    const tags = rawTags
      ? rawTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
      : [];

    // ดึง Features Vector จากรูปภาพแรก (เพื่อใช้ในการค้นหาความคล้ายคลึง)
    const primaryImg = new Image();
    primaryImg.src = selectedImages[0];
    await new Promise(r => primaryImg.onload = r);

    const featureVector = await extractFeatures(primaryImg);

    // หากไม่ได้กรอกบาร์โค้ด ลองสแกนจากรูปภาพ
    if (!barcode) {
      try {
        barcode = await extractBarcode(primaryImg) || '';
      } catch (err) {
        console.log('No barcode detected');
      }
    }

    const newProduct = {
      id: 'prod_' + Date.now(),
      name,
      barcode,
      tags,
      images: selectedImages,
      features: Array.from(featureVector),
      createdAt: new Date().toISOString()
    };

    await addProduct(newProduct);
    alert('บันทึกสินค้าสำเร็จเรียบร้อยแล้ว!');

    // รีเซ็ตฟอร์ม
    productForm.reset();
    selectedImages = [];
    renderPreviews();
  } catch (error) {
    console.error(error);
    alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'บันทึกสินค้า';
  }
});
