// ── PDF.js 설정 ──
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

// ── 상태 ──
let uploadedFiles = []; // { id, file, type, name, pages, uint8, pdfJsDoc, objUrl, width, height }
let mergedBlob    = null;
let draggedEl     = null;

// ── DOM ──
const $ = id => document.getElementById(id);
const uploadArea        = $('uploadArea');
const fileInput         = $('fileInput');
const filesSection      = $('filesSection');
const filesList         = $('filesList');
const clearAllBtn       = $('clearAllBtn');
const mergeBtn          = $('mergeBtn');
const resultSection     = $('resultSection');
const resultNameInput   = $('resultNameInput');
const resultPages       = $('resultPages');
const downloadBtn       = $('downloadBtn');
const mergeAgainBtn     = $('mergeAgainBtn');
const previewModal      = $('previewModal');
const closePreviewBtn   = $('closePreviewBtn');
const previewModalTitle = $('previewModalTitle');
const previewModalCanvas= $('previewModalCanvas');
const toastEl           = $('toast');

// ── 토스트 ──
let toastTmr = null;
function toast(msg, type = 'info') {
  clearTimeout(toastTmr);
  toastEl.textContent = msg;
  toastEl.className = 'toast show ' + type;
  toastTmr = setTimeout(() => { toastEl.className = 'toast'; }, 2800);
}

// ── 업로드 이벤트 ──
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', e => { e.preventDefault(); uploadArea.classList.remove('dragover'); });
uploadArea.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(isSupportedFile);
  if (files.length) handleFiles(files);
  else toast('PDF 또는 이미지 파일만 업로드할 수 있습니다.', 'error');
});
fileInput.addEventListener('change', e => {
  const files = Array.from(e.target.files).filter(isSupportedFile);
  if (files.length) handleFiles(files);
  fileInput.value = '';
});

clearAllBtn.addEventListener('click', () => {
  if (!uploadedFiles.length) return;
  uploadedFiles.forEach(revokeFileUrl);
  uploadedFiles = []; mergedBlob = null;
  filesSection.style.display  = 'none';
  resultSection.style.display = 'none';
  previewModal.style.display  = 'none';
  toast('전체 삭제됨', 'info');
});

mergeBtn.addEventListener('click', handleMerge);
mergeAgainBtn.addEventListener('click', () => { resultSection.style.display = 'none'; mergedBlob = null; });
downloadBtn.addEventListener('click', handleDownload);
closePreviewBtn.addEventListener('click', () => { previewModal.style.display = 'none'; });
previewModal.addEventListener('click', e => { if (e.target === previewModal) previewModal.style.display = 'none'; });

const LARGE_FILE_WARN = 200 * 1024 * 1024; // 200 MB 이상이면 경고만

function isSupportedFile(file) {
  return isPdfFile(file) || isImageFile(file);
}

function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function isImageFile(file) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}

// ── 파일 처리 ──
async function handleFiles(files) {
  for (const f of files) await addFile(f);
  updateFilesList();
  filesSection.style.display = 'block';
  updateDefaultName();
}

async function addFile(file) {
  if (file.size > LARGE_FILE_WARN) {
    toast('"' + file.name + '" 파일이 큽니다. 처리 중 브라우저가 느려질 수 있어요.', 'info');
  }
  if (isImageFile(file)) {
    await addImageFile(file);
    return;
  }

  try {
    const ab    = await file.arrayBuffer();
    const uint8 = new Uint8Array(ab);

    // 암호화 여부 확인
    let isEncrypted = false;
    try {
      await PDFLib.PDFDocument.load(uint8);
    } catch (e) {
      if (e.message && e.message.includes('encrypted')) {
        isEncrypted = true;
      } else {
        throw e;
      }
    }

    const pdfDoc = await PDFLib.PDFDocument.load(uint8, { ignoreEncryption: true });
    const pages  = pdfDoc.getPageCount();

    let pdfJsDoc = null;
    try {
      const copy = new Uint8Array(uint8.length);
      copy.set(uint8);
      pdfJsDoc = await pdfjsLib.getDocument({
        data: copy,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      }).promise;
    } catch (e) {
      console.warn('pdf.js 로드 실패 (미리보기 불가):', e);
    }

    uploadedFiles.push({
      id: Date.now() + Math.random(),
      file, type: 'pdf', name: file.name, pages, uint8, pdfJsDoc, isEncrypted,
    });

    if (isEncrypted) {
      toast('"' + file.name + '" 은 암호화된 PDF입니다. 병합 결과가 정상적이지 않을 수 있어요.', 'info');
    }
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('encrypted')) {
      toast('"' + file.name + '" 은 비밀번호가 걸린 PDF라 열 수 없습니다.', 'error');
    } else {
      toast('"' + file.name + '" 로드 실패', 'error');
    }
  }
}

function addImageFile(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      uploadedFiles.push({
        id: Date.now() + Math.random(),
        file,
        type: 'image',
        name: file.name,
        pages: 1,
        width: img.naturalWidth,
        height: img.naturalHeight,
        objUrl: url,
      });
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast('"' + file.name + '" 이미지 로드 실패', 'error');
      resolve();
    };
    img.src = url;
  });
}

// ── 기본 파일명: 원본 파일명들을 + 로 연결 ──
function updateDefaultName() {
  const names = uploadedFiles.map(f => stripExtension(f.name));
  resultNameInput.value = names.join(' + ');
}

// ── 파일 목록 렌더링 ──
function updateFilesList() {
  filesList.innerHTML = '';
  uploadedFiles.forEach((fd, idx) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.draggable = true;
    item.dataset.id = fd.id;

    // 드래그 핸들
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="9" cy="5" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="9" cy="19" r="1.2"/><circle cx="15" cy="5" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="15" cy="19" r="1.2"/></svg>';

    // 썸네일
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'file-thumb-wrap';
    thumbWrap.title = '클릭하여 미리보기';
    const canvas = document.createElement('canvas');
    canvas.className = 'file-thumb-canvas';
    thumbWrap.appendChild(canvas);
    thumbWrap.addEventListener('click', e => { e.stopPropagation(); showPreview(fd.id); });
    renderThumb(fd, canvas);

    // 정보
    const info = document.createElement('div');
    info.className = 'file-item-info';
    info.innerHTML =
      '<div class="file-item-name">' + escHtml(fd.name) + '</div>' +
      '<div class="file-item-meta">' + getFileMeta(fd) + '</div>';

    // 순서 배지
    const badge = document.createElement('div');
    badge.className = 'order-badge';
    badge.textContent = idx + 1;

    // 제거 버튼
    const rmBtn = document.createElement('button');
    rmBtn.className = 'btn btn-danger-ghost';
    rmBtn.textContent = '×';
    rmBtn.title = '제거';
    rmBtn.addEventListener('click', () => { removeFile(fd.id); });

    item.append(handle, thumbWrap, info, badge, rmBtn);

    // 드래그 이벤트
    item.addEventListener('dragstart', e => {
      draggedEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (draggedEl && draggedEl !== item) {
        const rect = item.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        filesList.insertBefore(draggedEl, after ? item.nextSibling : item);
      }
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      // 순서 재정렬
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
  updateDefaultName();
}

async function renderThumb(fd, canvas) {
  if (fd.type === 'image') {
    renderImageToCanvas(fd, canvas, 52, 66);
    return;
  }
  if (!fd.pdfJsDoc) return;
  try {
    const page = await fd.pdfJsDoc.getPage(1);
    const vp   = page.getViewport({ scale: 0.25 });
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  } catch (e) { console.warn('thumb 실패', e); }
}

function removeFile(id) {
  const removed = uploadedFiles.find(f => f.id.toString() === id.toString());
  if (removed) revokeFileUrl(removed);
  uploadedFiles = uploadedFiles.filter(f => f.id.toString() !== id.toString());
  if (!uploadedFiles.length) {
    filesSection.style.display = 'none';
    previewModal.style.display = 'none';
  } else {
    updateFilesList();
  }
}

// ── 미리보기 ──
async function showPreview(id) {
  const fd = uploadedFiles.find(f => f.id.toString() === id.toString());
  if (!fd) { toast('미리보기를 불러올 수 없습니다.', 'error'); return; }

  previewModalTitle.textContent = fd.name;
  previewModal.style.display = 'flex';

  if (fd.type === 'image') {
    const container = previewModalCanvas.parentElement;
    const maxW = Math.max(container.clientWidth - 32, 400);
    const scale = Math.min(maxW / fd.width, 2);
    renderImageToCanvas(fd, previewModalCanvas, fd.width * scale, fd.height * scale);
    return;
  }

  if (!fd.pdfJsDoc) { toast('미리보기를 불러올 수 없습니다.', 'error'); return; }

  try {
    const page = await fd.pdfJsDoc.getPage(1);
    const container = previewModalCanvas.parentElement;
    const w     = Math.max(container.clientWidth - 32, 400);
    const vp    = page.getViewport({ scale: 1 });
    const scale = Math.min(w / vp.width, 2);
    const svp   = page.getViewport({ scale });
    const dpr   = window.devicePixelRatio || 1;

    previewModalCanvas.width  = svp.width  * dpr;
    previewModalCanvas.height = svp.height * dpr;
    previewModalCanvas.style.width  = svp.width  + 'px';
    previewModalCanvas.style.height = svp.height + 'px';

    const ctx = previewModalCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    await page.render({ canvasContext: ctx, viewport: svp }).promise;
  } catch (e) {
    console.error(e); toast('미리보기 렌더링 오류', 'error');
  }
}

// ── 병합 실행 ──
async function handleMerge() {
  if (!uploadedFiles.length) { toast('병합할 파일을 업로드하세요.', 'error'); return; }
  if (uploadedFiles.length < 2) { toast('최소 2개 이상의 파일이 필요합니다.', 'error'); return; }

  try {
    mergeBtn.disabled = true; mergeBtn.textContent = '병합 중…';
    const merged = await PDFLib.PDFDocument.create();
    let total = 0;

    for (const fd of uploadedFiles) {
      if (fd.type === 'image') {
        await addImagePage(merged, fd);
        total += 1;
      } else {
        const copy = new Uint8Array(fd.uint8.length);
        copy.set(fd.uint8);
        const src   = await PDFLib.PDFDocument.load(copy);
        const pages = await merged.copyPages(src, Array.from({ length: src.getPageCount() }, (_, i) => i));
        pages.forEach(p => merged.addPage(p));
        total += src.getPageCount();
      }
    }

    const bytes  = await merged.save();
    mergedBlob   = new Blob([bytes], { type: 'application/pdf' });

    // 기본 파일명: 원본 파일명들 + 로 연결
    const names = uploadedFiles.map(f => stripExtension(f.name));
    resultNameInput.value = names.join(' + ');
    resultPages.textContent = '총 ' + total + '페이지';

    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth' });
    toast(uploadedFiles.length + '개 파일 병합 완료!', 'success');
  } catch (err) {
    console.error(err); toast('병합 중 오류가 발생했습니다.', 'error');
  } finally {
    mergeBtn.disabled = false; mergeBtn.textContent = '병합 실행';
  }
}

// ── 다운로드 (이름 변경 반영) ──
function handleDownload() {
  if (!mergedBlob) return;
  const name = (resultNameInput.value.trim() || 'merged') + '.pdf';
  const url  = URL.createObjectURL(mergedBlob);
  const a    = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function addImagePage(doc, fd) {
  const pdfImage = await embedImage(doc, fd);
  const page = doc.addPage([pdfImage.width, pdfImage.height]);
  page.drawImage(pdfImage, { x: 0, y: 0, width: pdfImage.width, height: pdfImage.height });
}

async function embedImage(doc, fd) {
  const type = fd.file.type.toLowerCase();

  if (type === 'image/png' || /\.png$/i.test(fd.name)) {
    const bytes = new Uint8Array(await fd.file.arrayBuffer());
    return doc.embedPng(bytes);
  }

  if (type === 'image/jpeg' || /\.jpe?g$/i.test(fd.name)) {
    const bytes = new Uint8Array(await fd.file.arrayBuffer());
    return doc.embedJpg(bytes);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
      try { resolve(await doc.embedJpg(bytes)); }
      catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = fd.objUrl;
  });
}

function renderImageToCanvas(fd, canvas, maxW, maxH) {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(maxW / fd.width, maxH / fd.height);
    const drawW = Math.max(fd.width * scale, 1);
    const drawH = Math.max(fd.height * scale, 1);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = drawW * dpr;
    canvas.height = drawH * dpr;
    canvas.style.width = drawW + 'px';
    canvas.style.height = drawH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, drawW, drawH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, drawW, drawH);
    ctx.drawImage(img, 0, 0, drawW, drawH);
  };
  img.src = fd.objUrl;
}

function getFileMeta(fd) {
  if (fd.type === 'image') return fd.width + ' × ' + fd.height + 'px · 1페이지';
  return fd.pages + '페이지';
}

function stripExtension(name) {
  return name.replace(/\.(pdf|png|jpe?g|webp|gif|bmp)$/i, '');
}

function revokeFileUrl(fd) {
  if (fd && fd.objUrl) URL.revokeObjectURL(fd.objUrl);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
