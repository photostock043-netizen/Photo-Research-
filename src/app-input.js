import { saveProduct } from './db.js';
import { extractFeatures } from './vision.js';

let selectedImages = [];

const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');
const previewContainer = document.getElementById('imagePreviewContainer');
const productForm = document.getElementById('productForm');

// อ่านไฟล์แล้วนำไปต่อท้าย selectedImages
function handleFiles(files) {
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
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.display = 'inline-block';

    const img = document.createElement('img');
    img.src = imgSrc;
    img.style.width = '80px';
    img.style.height = '80px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '4px';
    img.style.border = '1px solid #ccc';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.innerHTML = '&times;';
    delBtn.style.position = 'absolute';
    delBtn.style.top = '0';
    delBtn.style.right = '0';
    delBtn.style.background = 'red';
    delBtn.style.color = 'white';
    delBtn.style.border = 'none';
    delBtn.style.borderRadius = '0 4px 0 4px';
    delBtn.style.cursor = 'pointer';
    delBtn.onclick = () => {
      selectedImages.splice(index, 1);
      renderPreviews();
    };

    wrap.appendChild(img);
    wrap.appendChild(delBtn);
    previewContainer.appendChild(wrap);
  });
}

// 1. ถ่ายจากกล้อง (ถ่ายทีละรูปแล้วนำมาสะสมใน Array)
cameraInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  e.target.value = '';
});

// 2. เลือกจากคลัง (เลือกพร้อมกันหลายๆ รูปได้)
galleryInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  e.target.value = '';
});

// บันทึกสินค้า
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (selectedImages.length === 0) {
    alert('กรุณาถ่ายรูปหรือเลือกรูปภาพอย่างน้อย 1 รูป');
    return;
  }

  const barcode = document.getElementById('barcodeInput').value.trim();
  const name = document.getElementById('nameInput').value.trim();
  const tagsRaw = document.getElementById('tagsInput').value.trim();

  // จัดการ Tags (ถ้าไม่กรอกจะได้ [])
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังประมวลผล...';

  try {
    // โหลดรูปแรกเพื่อสร้าง Features Vector สำหรับค้นหา
    const tempImg = new Image();
    tempImg.src = selectedImages[0];
    await new Promise(res => tempImg.onload = res);

    const features = await extractFeatures(tempImg);

    const productData = {
      barcode,
      name,
      image: selectedImages[0], // รูปหลัก (เพื่อไม่ให้พังกับระบบเดิม)
      images: selectedImages,   // รูปภาพทั้งหมด
      tags,                     // ป้ายกำกับ
      features: Array.from(features)
    };

    await saveProduct(productData);
    alert('บันทึกสินค้าเรียบร้อยแล้ว');
    
    productForm.reset();
    selectedImages = [];
    renderPreviews();
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาด: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'บันทึกสินค้า';
  }
});
