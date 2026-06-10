// ── PDF.js 설정 ──
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

// ── 품질 프리셋 ──
const PRESETS = {
  max:      { scale: 1.2, quality: 0.55 },
  balanced: { scale: 1.5, quality: 0.72 },
  high:     { scale: 2.0, quality: 0.88 },
};

// ── 상태 ──
let loadedFile     = null;
let compressedBlob = null;
let selectedQuality = 'balanced';

// ── DOM ──
const $ = id => document.getElementById(id);
const uploadArea       = $('uploadArea');
const fileInput        = $('fileInput');
const fileInfoBar      = $('fileInfoBar');
const fileNameEl       = $('fileName');
const filePagesEl      = $('filePages');
const fileSizeBadge    = $('fileSizeBadge');
const removeFileBtn    = $('removeFileBtn');
const settingsSection  = $('settingsSection');
const qualityGrid      = $('qualityGrid');
const compressBtn      = $('compressBtn');
const progressSection  = $('progressSection');
const progressLabel    = $('progressLabel');
const progressFill     = $('progressFill');
const resultSection    = $('resultSection');
const sizeBeforeVal    = $('sizeBeforeVal');
const sizeAfterVal     = $('sizeAfterVal');
const reductionBadge   = $('reductionBadge');
const noGainWarning    = $('noGainWarning');
const resultNameInput  = $('resultNameInput');
const downloadBtn      = $('downloadBtn');
const compressAgainBtn = $('compressAgainBtn');
const toastEl          = $('toast');

// ── 토스트 ──
let toastTmr = null;
function toast(msg, type = 'info') {
  clearTimeout(toastTmr);
  toastEl.textContent = msg;
  toastEl.className = 'toast show ' + type;
  toastTmr = setTimeout(() => { toastEl.className = 'toast'; }, 2800);
}

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

// ── 업로드 이벤트 ──
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', e => { e.preventDefault(); uploadArea.classList.remove('dragover'); });
uploadArea.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
  if (files.length) handleFile(files[0]);
  else toast('PDF 파일만 업로드할 수 있습니다.', 'error');
});
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
  fileInput.value = '';
});

removeFileBtn.addEventListener('click', resetAll);

qualityGrid.addEventListener('click', e => {
  const card = e.target.closest('.quality-card');
  if (!card) return;
  selectedQuality = card.dataset.quality;
  qualityGrid.querySelectorAll('.quality-card').forEach(c => {
    c.classList.toggle('selected', c === card);
    c.setAttribute('aria-pressed', c === card ? 'true' : 'false');
  });
});

compressBtn.addEventListener('click', handleCompress);
compressAgainBtn.addEventListener('click', () => {
  compressedBlob = null;
  resultSection.style.display   = 'none';
  settingsSection.style.display = 'block';
});
downloadBtn.addEventListener('click', handleDownload);

// ── 파일 처리 ──
const LARGE_FILE_WARN = 200 * 1024 * 1024; // 200 MB 이상이면 경고만

async function handleFile(file) {
  if (file.size > LARGE_FILE_WARN) {
    toast('파일이 큽니다. 처리 중 브라우저가 느려질 수 있어요.', 'info');
  }
  try {
    const ab    = await file.arrayBuffer();
    const uint8 = new Uint8Array(ab);

    let isEncrypted = false;
    try {
      await PDFLib.PDFDocument.load(uint8);
    } catch (e) {
      if (e.message && e.message.includes('encrypted')) isEncrypted = true;
      else throw e;
    }
    if (isEncrypted) { toast('암호화된 PDF는 압축할 수 없습니다.', 'error'); return; }

    const pdfDoc = await PDFLib.PDFDocument.load(uint8);
    const pages  = pdfDoc.getPageCount();

    loadedFile = { file, name: file.name, pages, uint8, originalSize: file.size };

    fileNameEl.textContent   = file.name;
    filePagesEl.textContent  = pages + '페이지';
    fileSizeBadge.textContent = fmtSize(file.size);
    fileInfoBar.style.display     = 'flex';
    settingsSection.style.display = 'block';
    resultSection.style.display   = 'none';
    progressSection.style.display = 'none';

    resultNameInput.value = file.name.replace(/\.pdf$/i, '') + '_compressed';
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('encrypted')) {
      toast('비밀번호가 걸린 PDF는 압축할 수 없습니다.', 'error');
    } else {
      toast('파일 로드에 실패했습니다.', 'error');
    }
  }
}

// ── 압축 실행 ──
async function handleCompress() {
  if (!loadedFile) return;

  const preset = PRESETS[selectedQuality];
  compressBtn.disabled = true;
  compressBtn.textContent = '압축 중…';
  settingsSection.style.display = 'none';
  progressSection.style.display = 'block';
  resultSection.style.display   = 'none';

  try {
    const bytes = await compressPDF(loadedFile.uint8, preset, loadedFile.pages);
    compressedBlob = new Blob([bytes], { type: 'application/pdf' });

    const origSize  = loadedFile.originalSize;
    const compSize  = compressedBlob.size;
    const reduction = Math.round((1 - compSize / origSize) * 100);

    sizeBeforeVal.textContent = fmtSize(origSize);
    sizeAfterVal.textContent  = fmtSize(compSize);

    if (reduction > 0) {
      reductionBadge.textContent = '−' + reduction + '%';
      reductionBadge.className   = 'reduction-badge reduction-good';
      noGainWarning.style.display = 'none';
    } else {
      reductionBadge.textContent = '+' + Math.abs(reduction) + '%';
      reductionBadge.className   = 'reduction-badge reduction-bad';
      noGainWarning.style.display = 'block';
    }

    progressSection.style.display = 'none';
    resultSection.style.display   = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth' });
    toast('압축 완료!', 'success');
  } catch (err) {
    console.error(err);
    toast('압축 중 오류가 발생했습니다.', 'error');
    progressSection.style.display = 'none';
    settingsSection.style.display = 'block';
  } finally {
    compressBtn.disabled = false;
    compressBtn.textContent = '압축 실행';
  }
}

// ── 하이브리드 압축
// 텍스트가 있는 페이지: pdf-lib copyPages로 구조 보존 (텍스트·링크·폰트 유지)
// 텍스트 없는 페이지(스캔 이미지 등): JPEG 래스터화로 압축
async function compressPDF(uint8, preset, totalPages) {
  const copy = new Uint8Array(uint8.length);
  copy.set(uint8);

  const pdfJsDoc = await pdfjsLib.getDocument({
    data: copy,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
  }).promise;

  const srcDoc = await PDFLib.PDFDocument.load(uint8);
  const newDoc = await PDFLib.PDFDocument.create();

  copyMetadata(srcDoc, newDoc);

  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');

  for (let i = 1; i <= totalPages; i++) {
    updateProgress(i, totalPages);

    const page        = await pdfJsDoc.getPage(i);
    const textContent = await page.getTextContent();
    const hasText     = textContent.items.length > 0;

    if (hasText) {
      // 텍스트 페이지: 구조 그대로 복사 (텍스트 검색·복사·링크·북마크 보존)
      const [copied] = await newDoc.copyPages(srcDoc, [i - 1]);
      newDoc.addPage(copied);
    } else {
      // 이미지 전용 페이지: JPEG 압축
      const viewport = page.getViewport({ scale: preset.scale });
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const dataUrl    = canvas.toDataURL('image/jpeg', preset.quality);
      const base64     = dataUrl.split(',')[1];
      const jpegBytes  = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const jpegImage  = await newDoc.embedJpg(jpegBytes);
      const pdfPage    = newDoc.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(jpegImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    }
  }

  return newDoc.save({ useObjectStreams: true });
}

// ── 메타데이터 복사 ──
function copyMetadata(src, dst) {
  const fields = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'];
  for (const f of fields) {
    try {
      const v = src['get' + f]?.();
      if (v) dst['set' + f](v);
    } catch (_) {}
  }
}

function updateProgress(current, total) {
  const pct = Math.round((current / total) * 100);
  progressFill.style.width  = pct + '%';
  progressLabel.textContent = current + ' / ' + total + ' 페이지';
}

// ── 다운로드 ──
function handleDownload() {
  if (!compressedBlob) return;
  const name = (resultNameInput.value.trim() || 'compressed') + '.pdf';
  const url  = URL.createObjectURL(compressedBlob);
  const a    = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 초기화 ──
function resetAll() {
  loadedFile     = null;
  compressedBlob = null;
  fileInfoBar.style.display     = 'none';
  settingsSection.style.display = 'none';
  progressSection.style.display = 'none';
  resultSection.style.display   = 'none';
}
