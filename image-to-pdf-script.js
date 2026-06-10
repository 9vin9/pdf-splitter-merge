// ── 페이지 크기 프리셋 (단위: pt, 1pt = 1/72 inch) ──
const PAGE_SIZES = {
  original: null,
  a4:     { width: 595.28, height: 841.89 },
  letter: { width: 612,    height: 792    },
};
const PAGE_MARGIN = 24; // A4/Letter 여백 (pt)

// ── 상태 ──
let uploadedFiles = []; // { id, file, name, width, height, objUrl }
let resultBlob    = null;
let selectedSize  = 'original';
let draggedEl     = null;

// ── DOM ──
const $ = id => document.getElementById(id);
const uploadArea     = $('uploadArea');
const fileInput      = $('fileInput');
const settingsSection= $('settingsSection');
const sizeGrid       = $('sizeGrid');
const filesSection   = $('filesSection');
const filesList      = $('filesList');
const clearAllBtn    = $('clearAllBtn');
const convertBtn     = $('convertBtn');
const resultSection  = $('resultSection');
const resultNameInput= $('resultNameInput');
const resultInfo     = $('resultInfo');
const downloadBtn    = $('downloadBtn');
const convertAgainBtn= $('convertAgainBtn');
const toastEl        = $('toast');

// ── 토스트 ──
let toastTmr = null;
function toast(msg, type = 'info') {
  clearTimeout(toastTmr);
  toastEl.textContent = msg;
  toastEl.className = 'toast show ' + type;
  toastTmr = setTimeout(() => { toastEl.className = 'toast'; }, 2800);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 업로드 이벤트 ──
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length) handleFiles(files);
  else toast('이미지 파일만 업로드할 수 있습니다.', 'error');
});
fileInput.addEventListener('change', e => {
  const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
  if (files.length) handleFiles(files);
  fileInput.value = '';
});

// ── 페이지 크기 선택 ──
sizeGrid.addEventListener('click', e => {
  const card = e.target.closest('.size-card');
  if (!card) return;
  selectedSize = card.dataset.size;
  sizeGrid.querySelectorAll('.size-card').forEach(c => {
    c.classList.toggle('selected', c === card);
    c.setAttribute('aria-pressed', c === card ? 'true' : 'false');
  });
});

clearAllBtn.addEventListener('click', () => {
  uploadedFiles.forEach(fd => URL.revokeObjectURL(fd.objUrl));
  uploadedFiles = []; resultBlob = null;
  filesSection.style.display   = 'none';
  settingsSection.style.display= 'none';
  resultSection.style.display  = 'none';
  toast('전체 삭제됨', 'info');
});

convertBtn.addEventListener('click', handleConvert);
convertAgainBtn.addEventListener('click', () => {
  resultBlob = null;
  resultSection.style.display = 'none';
});
downloadBtn.addEventListener('click', handleDownload);

// ── 파일 처리 ──
async function handleFiles(files) {
  for (const f of files) await addFile(f);
  updateFilesList();
  settingsSection.style.display = 'block';
  filesSection.style.display    = 'block';
  updateDefaultName();
}

function addFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      uploadedFiles.push({
        id: Date.now() + Math.random(),
        file,
        name: file.name,
        width:  img.naturalWidth,
        height: img.naturalHeight,
        objUrl: url,
      });
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast('"' + file.name + '" 로드 실패', 'error');
      resolve(); // 실패해도 나머지 파일 처리 계속
    };
    img.src = url;
  });
}

function removeFile(id) {
  const fd = uploadedFiles.find(f => f.id.toString() === id.toString());
  if (fd) URL.revokeObjectURL(fd.objUrl);
  uploadedFiles = uploadedFiles.filter(f => f.id.toString() !== id.toString());
  if (!uploadedFiles.length) {
    filesSection.style.display    = 'none';
    settingsSection.style.display = 'none';
  } else {
    updateFilesList();
    updateDefaultName();
  }
}

// ── 기본 파일명 ──
function updateDefaultName() {
  if (!uploadedFiles.length) return;
  if (uploadedFiles.length === 1) {
    resultNameInput.value = uploadedFiles[0].name.replace(/\.[^.]+$/, '');
  } else {
    resultNameInput.value = 'images';
  }
}

// ── 파일 목록 렌더링 ──
function updateFilesList() {
  filesList.innerHTML = '';
  uploadedFiles.forEach((fd, idx) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.draggable = true;
    item.dataset.id = fd.id;

    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="9" cy="5" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="9" cy="19" r="1.2"/><circle cx="15" cy="5" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="15" cy="19" r="1.2"/></svg>';

    const thumb = document.createElement('img');
    thumb.className = 'file-thumb';
    thumb.src = fd.objUrl;
    thumb.alt = fd.name;

    const info = document.createElement('div');
    info.className = 'file-item-info';
    info.innerHTML =
      '<div class="file-item-name">' + escHtml(fd.name) + '</div>' +
      '<div class="file-item-meta">' + fd.width + ' × ' + fd.height + 'px</div>';

    const badge = document.createElement('div');
    badge.className = 'order-badge';
    badge.textContent = idx + 1;

    const rmBtn = document.createElement('button');
    rmBtn.className = 'btn btn-danger-ghost';
    rmBtn.textContent = '×';
    rmBtn.title = '제거';
    rmBtn.addEventListener('click', () => removeFile(fd.id));

    item.append(handle, thumb, info, badge, rmBtn);

    item.addEventListener('dragstart', e => {
      draggedEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (draggedEl && draggedEl !== item) {
        const rect  = item.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        filesList.insertBefore(draggedEl, after ? item.nextSibling : item);
      }
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      const newOrder = Array.from(filesList.querySelectorAll('.file-item'))
        .map(el => uploadedFiles.find(f => f.id.toString() === el.dataset.id))
        .filter(Boolean);
      uploadedFiles = newOrder;
      updateFilesList();
      updateDefaultName();
      draggedEl = null;
    });

    filesList.appendChild(item);
  });
}

// ── 변환 실행 ──
async function handleConvert() {
  if (!uploadedFiles.length) { toast('이미지를 먼저 업로드하세요.', 'error'); return; }

  try {
    convertBtn.disabled = true;
    convertBtn.textContent = '변환 중…';

    const bytes = await buildPdf();
    resultBlob  = new Blob([bytes], { type: 'application/pdf' });

    resultInfo.textContent = '총 ' + uploadedFiles.length + '페이지';
    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth' });
    toast(uploadedFiles.length + '장 변환 완료!', 'success');
  } catch (err) {
    console.error(err);
    toast('변환 중 오류가 발생했습니다.', 'error');
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = 'PDF 변환';
  }
}

// ── PDF 빌드 ──
async function buildPdf() {
  const doc      = await PDFLib.PDFDocument.create();
  const pageSize = PAGE_SIZES[selectedSize];

  for (const fd of uploadedFiles) {
    const pdfImage = await embedImage(doc, fd);
    const imgW = pdfImage.width;
    const imgH = pdfImage.height;

    if (!pageSize) {
      // 원본 크기: 페이지 = 이미지 픽셀 크기
      const page = doc.addPage([imgW, imgH]);
      page.drawImage(pdfImage, { x: 0, y: 0, width: imgW, height: imgH });
    } else {
      // A4 / Letter: 비율 유지하며 여백 안에 맞춤
      const { width: pW, height: pH } = pageSize;
      const availW = pW - PAGE_MARGIN * 2;
      const availH = pH - PAGE_MARGIN * 2;
      const scale  = Math.min(availW / imgW, availH / imgH);
      const drawW  = imgW * scale;
      const drawH  = imgH * scale;
      const x = PAGE_MARGIN + (availW - drawW) / 2;
      const y = PAGE_MARGIN + (availH - drawH) / 2;
      const page = doc.addPage([pW, pH]);
      page.drawImage(pdfImage, { x, y, width: drawW, height: drawH });
    }
  }

  return doc.save();
}

// ── 이미지 임베드 ──
// PNG/JPG: 직접 임베드 (무손실)
// WebP/GIF/기타: canvas → JPEG 변환
async function embedImage(doc, fd) {
  const type = fd.file.type.toLowerCase();

  if (type === 'image/png') {
    const bytes = new Uint8Array(await fd.file.arrayBuffer());
    return doc.embedPng(bytes);
  }

  if (type === 'image/jpeg') {
    const bytes = new Uint8Array(await fd.file.arrayBuffer());
    return doc.embedJpg(bytes);
  }

  // WebP, GIF, BMP 등 → canvas → JPEG
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const dataUrl  = canvas.toDataURL('image/jpeg', 0.95);
      const base64   = dataUrl.split(',')[1];
      const bytes    = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      try { resolve(await doc.embedJpg(bytes)); }
      catch(e) { reject(e); }
    };
    img.onerror = reject;
    img.src = fd.objUrl;
  });
}

// ── 다운로드 ──
function handleDownload() {
  if (!resultBlob) return;
  const name = (resultNameInput.value.trim() || 'images') + '.pdf';
  const url  = URL.createObjectURL(resultBlob);
  const a    = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
