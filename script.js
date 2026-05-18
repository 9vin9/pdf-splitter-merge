// ── PDF.js 설정 ──
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

// ── 상태 ──
let pdfDoc = null;        // pdf-lib
let pdfJs  = null;        // pdf.js
let totalPages  = 0;
let currentPage = 1;
let origName    = '';
let selStart    = null;
let selEnd      = null;
let ranges      = [];     // [{start, end}]
let results     = [];     // [{name, url, blob, range}]
let history     = [];

// ── DOM ──
const $ = id => document.getElementById(id);
const uploadArea   = $('uploadArea');
const fileInput    = $('fileInput');
const fileInfoBar  = $('fileInfoBar');
const fileNameEl   = $('fileName');
const filePagesEl  = $('filePages');
const removeFileBtn= $('removeFileBtn');
const editorSection= $('editorSection');
const thumbList    = $('thumbList');
const previewCanvas= $('previewCanvas');
const pageInfoTxt  = $('pageInfoTxt');
const prevBtn      = $('prevBtn');
const nextBtn      = $('nextBtn');
const pageJumpInput= $('pageJumpInput');
const goBtn        = $('goBtn');
const startInput   = $('startInput');
const endInput     = $('endInput');
const addRangeBtn  = $('addRangeBtn');
const clearSelBtn  = $('clearSelBtn');
const selDot       = $('selDot');
const selText      = $('selText');
const rangesList   = $('rangesList');
const rangeCountBadge = $('rangeCountBadge');
const splitBtn     = $('splitBtn');
const chipsRow     = $('chipsRow');
const rangeBar     = $('rangeBar');
const resultSection= $('resultSection');
const resultList   = $('resultList');
const splitAgainBtn= $('splitAgainBtn');
const downloadAllBtn= $('downloadAllBtn');
const historySection= $('historySection');
const historyList  = $('historyList');
const restoreModal = $('restoreModal');
const closeRestoreBtn= $('closeRestoreBtn');
const cancelRestoreBtn= $('cancelRestoreBtn');
const confirmRestoreBtn= $('confirmRestoreBtn');
const restoreInfo  = $('restoreInfo');
const toastEl      = $('toast');

let restoreTarget = null;

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
  const f = e.dataTransfer.files;
  if (f.length && f[0].type === 'application/pdf') loadPdf(f[0]);
  else toast('PDF 파일만 업로드할 수 있습니다.', 'error');
});
fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f && f.type === 'application/pdf') loadPdf(f);
  else if (f) toast('PDF 파일만 업로드할 수 있습니다.', 'error');
});
removeFileBtn.addEventListener('click', resetAll);

// 범위 입력 키보드
startInput.addEventListener('keypress', e => { if (e.key === 'Enter') endInput.focus(); });
endInput.addEventListener('keypress', e => { if (e.key === 'Enter') addRange(); });

// 범위 추가 버튼
addRangeBtn.addEventListener('click', addRange);
clearSelBtn.addEventListener('click', clearSel);

// 분할 / 결과
splitBtn.addEventListener('click', runSplit);
splitAgainBtn.addEventListener('click', () => {
  resultSection.style.display = 'none';
  ranges = []; clearSel(); updateRangesUI();
});
downloadAllBtn.addEventListener('click', () => {
  results.forEach((_, i) => setTimeout(() => downloadResult(i), i * 300));
});

// 미리보기 내비
prevBtn.addEventListener('click', () => navigate(currentPage - 1));
nextBtn.addEventListener('click', () => navigate(currentPage + 1));
goBtn.addEventListener('click', goToPage);
pageJumpInput.addEventListener('keypress', e => { if (e.key === 'Enter') goToPage(); });

// 복구 모달
closeRestoreBtn.addEventListener('click', closeRestore);
cancelRestoreBtn.addEventListener('click', closeRestore);
confirmRestoreBtn.addEventListener('click', doRestore);
restoreModal.addEventListener('click', e => { if (e.target === restoreModal) closeRestore(); });

// ── PDF 로드 ──
async function loadPdf(file) {
  try {
    const ab = await file.arrayBuffer();
    pdfDoc = await PDFLib.PDFDocument.load(new Uint8Array(ab));
    pdfJs  = await pdfjsLib.getDocument({
      data: ab,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
    }).promise;

    totalPages  = pdfJs.numPages;
    origName    = file.name.replace(/\.pdf$/i, '');
    currentPage = 1;
    ranges = []; results = [];
    selStart = selEnd = null;

    fileNameEl.textContent  = file.name;
    filePagesEl.textContent = totalPages + '페이지';
    fileInfoBar.style.display  = 'flex';
    editorSection.style.display= 'block';
    resultSection.style.display= 'none';
    startInput.max = endInput.max = totalPages;
    startInput.value = endInput.value = '';

    await renderThumbs();
    await renderPreview(1);
    updateSelUI();
    updateRangesUI();
    toast(file.name + ' 로드 완료', 'success');
  } catch (err) {
    console.error(err);
    toast('PDF 로드에 실패했습니다.', 'error');
  }
}

// ── 썸네일 ──
async function renderThumbs() {
  thumbList.innerHTML = '';
  const promises = [];
  for (let i = 1; i <= totalPages; i++) {
    const item  = document.createElement('div');
    item.className   = 'thumb-item';
    item.dataset.page = i;

    const canvas = document.createElement('canvas');
    canvas.className = 'thumb-canvas';

    const btns = document.createElement('div');
    btns.className = 'thumb-btns';

    const bStart = document.createElement('button');
    bStart.className = 'thumb-btn start'; bStart.textContent = '시작';
    bStart.addEventListener('click', e => { e.stopPropagation(); setStart(i); });

    const bEnd = document.createElement('button');
    bEnd.className = 'thumb-btn end'; bEnd.textContent = '끝';
    bEnd.addEventListener('click', e => { e.stopPropagation(); setEnd(i); });

    btns.append(bStart, bEnd);

    const lbl = document.createElement('div');
    lbl.className = 'thumb-label'; lbl.textContent = i;

    item.append(canvas, btns, lbl);
    item.addEventListener('click', () => navigate(i));
    thumbList.appendChild(item);
    promises.push(renderThumb(i, canvas));
  }
  await Promise.all(promises);
  updateThumbHighlights();
}

async function renderThumb(n, canvas) {
  try {
    const page = await pdfJs.getPage(n);
    const vp   = page.getViewport({ scale: 0.3 });
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  } catch(e) { console.warn('thumb fail', n, e); }
}

// ── 큰 미리보기 ──
async function renderPreview(n) {
  if (!pdfJs) return;
  const page = await pdfJs.getPage(n);
  const wrap = previewCanvas.parentElement;
  const w    = wrap.clientWidth - 32;
  const vp   = page.getViewport({ scale: 1 });
  const scale = Math.min(w / vp.width, 1.8);
  const svp  = page.getViewport({ scale });
  previewCanvas.width  = svp.width;
  previewCanvas.height = svp.height;
  await page.render({ canvasContext: previewCanvas.getContext('2d'), viewport: svp }).promise;
  pageInfoTxt.textContent = n + ' / ' + totalPages;
}

function navigate(n) {
  if (n < 1 || n > totalPages) return;
  currentPage = n;
  renderPreview(n);
  pageJumpInput.value = n;
  pageJumpInput.max   = totalPages;
  updateThumbHighlights();
  const t = thumbList.querySelector('[data-page="' + n + '"]');
  if (t) t.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function goToPage() {
  const n = parseInt(pageJumpInput.value);
  if (n >= 1 && n <= totalPages) navigate(n);
  else { toast('1 ~ ' + totalPages + ' 사이 페이지를 입력하세요.', 'error'); pageJumpInput.value = currentPage; }
}

// ── 시작 / 끝 선택 ──
function setStart(n) {
  selStart = n;
  startInput.value = n;
  if (selEnd !== null && selEnd < selStart) { selEnd = null; endInput.value = ''; }
  navigate(n);
  updateSelUI();
  updateThumbHighlights();
  // 시작+끝 모두 채워졌으면 자동 추가
  if (selStart !== null && selEnd !== null) autoAddRange();
}

function setEnd(n) {
  selEnd = n;
  endInput.value = n;
  if (selStart !== null && selStart > selEnd) {
    [selStart, selEnd] = [selEnd, selStart];
    startInput.value = selStart; endInput.value = selEnd;
  }
  navigate(n);
  updateSelUI();
  updateThumbHighlights();
  // 시작+끝 모두 채워졌으면 자동 추가
  if (selStart !== null && selEnd !== null) autoAddRange();
}

function clearSel() {
  selStart = selEnd = null;
  startInput.value = endInput.value = '';
  updateSelUI(); updateThumbHighlights();
}

// ── 자동 범위 추가 (시작+끝 완성 시) ──
function autoAddRange() {
  const s = Math.min(selStart, selEnd);
  const e = Math.max(selStart, selEnd);
  if (ranges.some(r => r.start === s && r.end === e)) {
    toast('이미 추가된 범위입니다.', 'info');
    clearSel(); return;
  }
  ranges.push({ start: s, end: e });
  updateRangesUI();
  clearSel();
  toast(s + '~' + e + '페이지 추가됨', 'success');
}

// ── 수동 범위 추가 (버튼 클릭) ──
function addRange() {
  let s = parseInt(startInput.value);
  let e = parseInt(endInput.value);
  if (!s && selStart !== null) s = selStart;
  if (!e && selEnd   !== null) e = selEnd;
  if (!s || !e) { toast('시작과 끝 페이지를 입력하세요.', 'error'); return; }
  if (s < 1 || e < 1) { toast('페이지 번호는 1 이상이어야 합니다.', 'error'); return; }
  if (s > totalPages || e > totalPages) { toast('총 ' + totalPages + '페이지를 초과합니다.', 'error'); return; }
  if (s > e) [s, e] = [e, s];
  if (ranges.some(r => r.start === s && r.end === e)) { toast('이미 추가된 범위입니다.', 'error'); return; }
  ranges.push({ start: s, end: e });
  updateRangesUI(); clearSel();
  toast(s + '~' + e + '페이지 추가됨', 'success');
}

function removeRange(idx) {
  ranges.splice(idx, 1); updateRangesUI(); toast('범위 제거됨', 'info');
}

// ── UI 업데이트 ──
function updateSelUI() {
  if (selStart !== null && selEnd !== null) {
    selDot.className = 'sel-dot ready';
    selText.textContent = selStart + '~' + selEnd + '페이지 선택됨';
    clearSelBtn.style.display = 'inline-flex';
  } else if (selStart !== null) {
    selDot.className = 'sel-dot partial';
    selText.textContent = '시작: ' + selStart + '페이지 — 끝 페이지를 선택하세요';
    clearSelBtn.style.display = 'inline-flex';
  } else if (selEnd !== null) {
    selDot.className = 'sel-dot partial';
    selText.textContent = '끝: ' + selEnd + '페이지 — 시작 페이지를 선택하세요';
    clearSelBtn.style.display = 'inline-flex';
  } else {
    selDot.className = 'sel-dot';
    selText.textContent = '썸네일 위에서 시작/끝 선택';
    clearSelBtn.style.display = 'none';
  }
}

function updateRangesUI() {
  if (!ranges.length) {
    rangesList.style.display = 'none';
    rangeBar.style.display   = 'none';
    return;
  }
  rangesList.style.display = 'block';
  rangeBar.style.display   = 'flex';
  rangeCountBadge.textContent = ranges.length;

  chipsRow.innerHTML = '';
  ranges.forEach((r, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = r.start + '–' + r.end + ' <span style="color:var(--text-faint);font-size:.75rem;">(' + (r.end - r.start + 1) + ')</span>';
    const x = document.createElement('button');
    x.className = 'chip-x'; x.textContent = '×';
    x.addEventListener('click', () => removeRange(i));
    chip.appendChild(x);
    chipsRow.appendChild(chip);
  });

  rangeBar.innerHTML = '';
  ranges.forEach(r => {
    const tag = document.createElement('span');
    tag.className = 'bar-tag';
    tag.textContent = r.start + '–' + r.end;
    tag.addEventListener('click', () => navigate(r.start));
    rangeBar.appendChild(tag);
  });

  updateThumbHighlights();
}

function updateThumbHighlights() {
  const thumbs = thumbList.querySelectorAll('.thumb-item');
  const lo = (selStart !== null && selEnd !== null) ? Math.min(selStart, selEnd) : null;
  const hi = (selStart !== null && selEnd !== null) ? Math.max(selStart, selEnd) : null;

  thumbs.forEach(t => {
    const n = parseInt(t.dataset.page);
    t.classList.remove('is-current', 'is-start', 'is-end', 'is-between', 'is-in-range');
    if (n === currentPage) t.classList.add('is-current');
    if (lo !== null) {
      if (n === lo)              t.classList.add('is-start');
      else if (n === hi)         t.classList.add('is-end');
      else if (n > lo && n < hi) t.classList.add('is-between');
    } else {
      if (selStart !== null && n === selStart) t.classList.add('is-start');
      if (selEnd   !== null && n === selEnd)   t.classList.add('is-end');
    }
    for (const r of ranges) {
      if (n >= r.start && n <= r.end) { t.classList.add('is-in-range'); break; }
    }
  });
}

// ── 분할 실행 ──
async function runSplit() {
  if (!ranges.length) { toast('분할할 범위를 먼저 추가하세요.', 'error'); return; }
  try {
    splitBtn.disabled = true; splitBtn.textContent = '처리 중…';
    results = [];
    for (const r of ranges) {
      const newPdf = await PDFLib.PDFDocument.create();
      const idxs   = Array.from({ length: r.end - r.start + 1 }, (_, i) => r.start - 1 + i);
      const pages  = await newPdf.copyPages(pdfDoc, idxs);
      pages.forEach(p => newPdf.addPage(p));
      const bytes = await newPdf.save();
      const blob  = new Blob([bytes], { type: 'application/pdf' });
      results.push({
        name:  origName + '_' + r.start + '-' + r.end,
        url:   URL.createObjectURL(blob),
        pages: r.start + '–' + r.end,
        blob, range: r,
      });
    }
    showResults();
    addHistory();
    toast(results.length + '개 파일 분할 완료!', 'success');
    resultSection.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error(err); toast('분할 중 오류가 발생했습니다.', 'error');
  } finally {
    splitBtn.disabled = false; splitBtn.textContent = '분할 실행';
  }
}

// ── 결과 표시 (이름 변경 포함) ──
function showResults() {
  resultList.innerHTML = '';
  results.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'result-item-row';
    row.innerHTML =
      '<div class="name-edit-wrap">' +
        '<input class="name-input" data-idx="' + i + '" value="' + escHtml(r.name) + '" spellcheck="false">' +
        '<span class="name-suffix">.pdf</span>' +
      '</div>' +
      '<div class="result-item-sub" style="margin-left:8px;white-space:nowrap;">' + r.pages + '페이지</div>' +
      '<div class="result-item-actions">' +
        '<button class="btn btn-ghost btn-sm" data-action="resplit" data-idx="' + i + '">다시 분할</button>' +
        '<button class="btn btn-primary btn-sm" data-action="dl" data-idx="' + i + '">다운로드</button>' +
      '</div>';
    // 이름 변경 → 저장
    row.querySelector('.name-input').addEventListener('change', e => {
      results[i].name = e.target.value.trim() || results[i].name;
    });
    resultList.appendChild(row);
  });

  resultList.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const i = parseInt(btn.dataset.idx);
    if (btn.dataset.action === 'dl')      downloadResult(i);
    if (btn.dataset.action === 'resplit') resplitResult(i);
  }, { once: true });

  resultSection.style.display = 'block';
}

function downloadResult(i) {
  const r = results[i];
  const a = document.createElement('a');
  a.href = r.url; a.download = r.name + '.pdf';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function resplitResult(i) {
  const r = results[i];
  if (r.blob) {
    const f = new File([r.blob], r.name + '.pdf', { type: 'application/pdf' });
    await loadPdf(f);
    resultSection.style.display = 'none';
    editorSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// ── 히스토리 ──
function addHistory() {
  history.unshift({ ts: new Date().toLocaleString('ko-KR'), name: origName, ranges: ranges.map(r => ({...r})) });
  if (history.length > 10) history.length = 10;
  updateHistory();
}

function updateHistory() {
  if (!history.length) { historySection.style.display = 'none'; return; }
  historySection.style.display = 'block';
  historyList.innerHTML = '';
  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML =
      '<div class="history-item-top"><span class="history-item-name">' + escHtml(item.name) + '.pdf</span><span class="history-item-time">' + item.ts + '</span></div>' +
      '<div class="history-item-chips">' + item.ranges.map(r => '<span class="h-chip">' + r.start + '–' + r.end + '</span>').join('') + '</div>';
    div.addEventListener('click', () => openRestore(item));
    historyList.appendChild(div);
  });
}

// ── 복구 모달 ──
function openRestore(item) {
  if (!item.ranges.length) { toast('복구할 범위가 없습니다.', 'error'); return; }
  restoreTarget = item;
  restoreInfo.innerHTML =
    '<div class="info-row"><strong>파일</strong>' + escHtml(item.name) + '.pdf</div>' +
    '<div class="info-row"><strong>시간</strong>' + item.ts + '</div>' +
    '<div class="info-row"><strong>범위</strong>' + item.ranges.map(r => r.start + '–' + r.end).join(', ') + '</div>';
  restoreModal.style.display = 'flex';
}

function closeRestore() { restoreModal.style.display = 'none'; restoreTarget = null; }

async function doRestore() {
  if (!restoreTarget) return;
  ranges = restoreTarget.ranges.map(r => ({...r}));
  clearSel(); updateRangesUI(); closeRestore();
  await runSplit();
}

// ── 전체 리셋 ──
function resetAll() {
  pdfDoc = pdfJs = null; totalPages = 0; currentPage = 1;
  origName = ''; ranges = []; results = []; history = [];
  selStart = selEnd = null;
  fileInfoBar.style.display   = 'none';
  editorSection.style.display = 'none';
  resultSection.style.display = 'none';
  historySection.style.display= 'none';
  rangesList.style.display    = 'none';
  rangeBar.style.display      = 'none';
  fileInput.value = ''; thumbList.innerHTML = '';
  startInput.value = endInput.value = '';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}