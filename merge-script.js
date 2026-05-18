// ── PDF.js 설정 ──
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── 상태 ──
let uploadedFiles = []; // { id, file, name, pages, uint8, pdfJsDoc }
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
  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
  if (files.length) handleFiles(files);
  else toast('PDF 파일만 업로드할 수 있습니다.', 'error');
});
fileInput.addEventListener('change', e => {
  const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
  if (files.length) handleFiles(files);
  fileInput.value = '';
});

clearAllBtn.addEventListener('click', () => {
  if (!uploadedFiles.length) return;
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

// ── 파일 처리 ──
async function handleFiles(files) {
  for (const f of files) await addFile(f);
  updateFilesList();
  filesSection.style.display = 'block';
  updateDefaultName();
}

async function addFile(file) {
  try {
    const ab      = await file.arrayBuffer();
    const uint8   = new Uint8Array(ab);
    const pdfDoc  = await PDFLib.PDFDocument.load(uint8);
    const pages   = pdfDoc.getPageCount();

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
      file, name: file.name, pages, uint8, pdfJsDoc,
    });
  } catch (err) {
    console.error(err);
    toast('"' + file.name + '" 로드 실패', 'error');
  }
}

// ── 기본 파일명: 원본 파일명들을 + 로 연결 ──
function updateDefaultName() {
  const names = uploadedFiles.map(f => f.name.replace(/\.pdf$/i, ''));
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
      '<div class="file-item-meta">' + fd.pages + '페이지</div>';

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
  if (!fd.pdfJsDoc) return;
  try {
    const page = await fd.pdfJsDoc.getPage(1);
    const vp   = page.getViewport({ scale: 0.25 });
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  } catch (e) { console.warn('thumb 실패', e); }
}

function removeFile(id) {
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
  if (!fd || !fd.pdfJsDoc) { toast('미리보기를 불러올 수 없습니다.', 'error'); return; }

  previewModalTitle.textContent = fd.name;
  previewModal.style.display = 'flex';

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
      const copy = new Uint8Array(fd.uint8.length);
      copy.set(fd.uint8);
      const src   = await PDFLib.PDFDocument.load(copy);
      const pages = await merged.copyPages(src, Array.from({ length: src.getPageCount() }, (_, i) => i));
      pages.forEach(p => merged.addPage(p));
      total += src.getPageCount();
    }

    const bytes  = await merged.save();
    mergedBlob   = new Blob([bytes], { type: 'application/pdf' });

    // 기본 파일명: 원본 파일명들 + 로 연결
    const names = uploadedFiles.map(f => f.name.replace(/\.pdf$/i, ''));
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

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}