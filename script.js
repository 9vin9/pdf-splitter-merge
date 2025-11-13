script.js
// PDF.js 워커 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 전역 변수
let currentPdfDoc = null;
let currentPdfBytes = null;
let pdfJsDoc = null; // PDF.js 문서
let totalPages = 0;
let splitRanges = [];
let splitResults = [];
let splitHistory = [];
let currentPage = 1;
let selectionStart = null;
let selectionEnd = null;
let selectionMode = null; // 'start' or 'end'

// DOM 요소
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const filePages = document.getElementById('filePages');
const removeFile = document.getElementById('removeFile');
const previewSection = document.getElementById('previewSection');
const thumbnailList = document.getElementById('thumbnailList');
const previewCanvas = document.getElementById('previewCanvas');
const currentPageInfo = document.getElementById('currentPageInfo');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageJumpInput = document.getElementById('pageJumpInput');
const goToPageBtn = document.getElementById('goToPageBtn');
const selectStartBtn = document.getElementById('selectStartBtn');
const selectEndBtn = document.getElementById('selectEndBtn');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');
const selectedRange = document.getElementById('selectedRange');
const addRangeBtn = document.getElementById('addRangeBtn');
const splitRangesBtn = document.getElementById('splitRangesBtn');
const rangesList = document.getElementById('rangesList');
const rangesListItems = document.getElementById('rangesListItems');
const resultSection = document.getElementById('resultSection');
const resultList = document.getElementById('resultList');
const splitAgainBtn = document.getElementById('splitAgain');
const downloadAllBtn = document.getElementById('downloadAll');
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const closeGuideBtn = document.getElementById('closeGuideBtn');
const restoreModal = document.getElementById('restoreModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelRestoreBtn = document.getElementById('cancelRestoreBtn');
const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
const modalInfo = document.getElementById('modalInfo');
const completeModal = document.getElementById('completeModal');
const closeCompleteModalBtn = document.getElementById('closeCompleteModalBtn');
const confirmCompleteBtn = document.getElementById('confirmCompleteBtn');
const completeFileCount = document.getElementById('completeFileCount');

let restoreHistoryItem = null;

// 이벤트 리스너
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
removeFile.addEventListener('click', handleRemoveFile);

selectStartBtn.addEventListener('click', () => {
    selectionMode = 'start';
    updateSelectionButtons();
});

selectEndBtn.addEventListener('click', () => {
    // 순서 검증: 시작 페이지가 먼저 선택되어야 함
    if (!selectionStart) {
        alert('먼저 "시작 페이지" 버튼을 클릭하고 시작할 페이지를 선택해주세요.');
        return;
    }
    selectionMode = 'end';
    updateSelectionButtons();
});

clearSelectionBtn.addEventListener('click', () => {
    selectionStart = null;
    selectionEnd = null;
    selectionMode = null;
    updateSelectionButtons();
    updateSelectionInfo();
    updateThumbnails();
});

addRangeBtn.addEventListener('click', handleAddRange);
splitRangesBtn.addEventListener('click', handleSplitRanges);
splitAgainBtn.addEventListener('click', handleSplitAgain);
downloadAllBtn.addEventListener('click', handleDownloadAll);
closeGuideBtn.addEventListener('click', () => {
    document.querySelector('.usage-guide').style.display = 'none';
});
closeModalBtn.addEventListener('click', closeRestoreModal);
cancelRestoreBtn.addEventListener('click', closeRestoreModal);
confirmRestoreBtn.addEventListener('click', handleConfirmRestore);
closeCompleteModalBtn.addEventListener('click', closeCompleteModal);
confirmCompleteBtn.addEventListener('click', handleConfirmComplete);

// 모달 외부 클릭 시 닫기
restoreModal.addEventListener('click', (e) => {
    if (e.target === restoreModal) {
        closeRestoreModal();
    }
});

completeModal.addEventListener('click', (e) => {
    if (e.target === completeModal) {
        closeCompleteModal();
    }
});

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderLargePreview(currentPage);
        updatePageJumpInput();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderLargePreview(currentPage);
        updatePageJumpInput();
    }
});

goToPageBtn.addEventListener('click', () => {
    goToPage();
});

pageJumpInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        goToPage();
    }
});

// 페이지 이동 함수
function goToPage() {
    const pageNum = parseInt(pageJumpInput.value);
    if (pageNum && pageNum >= 1 && pageNum <= totalPages) {
        currentPage = pageNum;
        renderLargePreview(pageNum);
        updatePageJumpInput();
        
        // 해당 썸네일로 스크롤
        const thumbnail = thumbnailList.querySelector(`[data-page="${pageNum}"]`);
        if (thumbnail) {
            thumbnail.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        alert(`페이지 번호는 1부터 ${totalPages}까지 입력할 수 있습니다.`);
        updatePageJumpInput();
    }
}

// 페이지 입력 필드 업데이트
function updatePageJumpInput() {
    if (pageJumpInput) {
        pageJumpInput.value = currentPage;
        pageJumpInput.max = totalPages;
    }
}

// 드래그 앤 드롭 핸들러
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        loadPdfFile(files[0]);
    } else {
        alert('PDF 파일만 업로드할 수 있습니다.');
    }
}

// 파일 선택 핸들러
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        loadPdfFile(file);
    } else {
        alert('PDF 파일만 업로드할 수 있습니다.');
    }
}

// PDF 파일 로드
async function loadPdfFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        currentPdfBytes = new Uint8Array(arrayBuffer);
        
        // PDF-lib로 로드 (분할용)
        currentPdfDoc = await PDFLib.PDFDocument.load(currentPdfBytes);
        
        // PDF.js로 로드 (미리보기용)
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfJsDoc = await loadingTask.promise;
        totalPages = pdfJsDoc.numPages;

        // UI 업데이트
        fileName.textContent = file.name;
        filePages.textContent = `총 ${totalPages}페이지`;
        fileInfo.style.display = 'block';
        previewSection.style.display = 'block';

        // 기존 데이터 초기화
        splitRanges = [];
        selectionStart = null;
        selectionEnd = null;
        selectionMode = null;
        currentPage = 1;
        rangesList.style.display = 'none';
        resultSection.style.display = 'none';
        splitResults = [];

        // 미리보기 렌더링
        await renderThumbnails();
        await renderLargePreview(1);
        updatePageJumpInput();
        updateSelectionButtons();
        updateSelectionInfo();
    } catch (error) {
        console.error('PDF 로드 오류:', error);
        alert('PDF 파일을 로드하는 중 오류가 발생했습니다.');
    }
}

// 썸네일 렌더링
async function renderThumbnails() {
    thumbnailList.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        const thumbnailItem = document.createElement('div');
        thumbnailItem.className = 'thumbnail-item';
        thumbnailItem.dataset.page = i;
        
        const canvas = document.createElement('canvas');
        canvas.className = 'thumbnail-canvas';
        
        const pageLabel = document.createElement('div');
        pageLabel.className = 'thumbnail-label';
        pageLabel.textContent = `페이지 ${i}`;
        
        thumbnailItem.appendChild(canvas);
        thumbnailItem.appendChild(pageLabel);
        
        // 썸네일 클릭 이벤트
        thumbnailItem.addEventListener('click', () => {
            currentPage = i;
            renderLargePreview(i);
            updatePageJumpInput();
            handleThumbnailClick(i);
        });
        
        thumbnailList.appendChild(thumbnailItem);
        
        // 썸네일 렌더링
        await renderThumbnail(i, canvas);
    }
    
    updateThumbnails();
}

// 썸네일 하나 렌더링
async function renderThumbnail(pageNum, canvas) {
    const page = await pdfJsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 0.3 });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
}

// 큰 미리보기 렌더링
async function renderLargePreview(pageNum) {
    if (!pdfJsDoc) return;
    
    const page = await pdfJsDoc.getPage(pageNum);
    const container = previewCanvas.parentElement;
    const containerWidth = container.clientWidth - 40;
    const viewport = page.getViewport({ scale: 1 });
    const scale = containerWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale: scale });
    
    previewCanvas.width = scaledViewport.width;
    previewCanvas.height = scaledViewport.height;
    
    const context = previewCanvas.getContext('2d');
    await page.render({
        canvasContext: context,
        viewport: scaledViewport
    }).promise;
    
    currentPageInfo.textContent = `페이지 ${pageNum} / ${totalPages}`;
    
    // 썸네일 하이라이트 업데이트
    updateThumbnails();
}

// 썸네일 클릭 처리
function handleThumbnailClick(pageNum) {
    if (selectionMode === 'start') {
        selectionStart = pageNum;
        if (selectionEnd && selectionStart > selectionEnd) {
            selectionEnd = null;
        }
        selectionMode = null;
        updateSelectionButtons();
        updateSelectionInfo();
        updateThumbnails();
    } else if (selectionMode === 'end') {
        // 순서 검증: 시작 페이지가 먼저 선택되어야 함
        if (!selectionStart) {
            alert('먼저 "시작 페이지" 버튼을 클릭하고 시작할 페이지를 선택해주세요.');
            selectionMode = null;
            updateSelectionButtons();
            return;
        }
        if (pageNum >= selectionStart) {
            selectionEnd = pageNum;
        } else {
            alert('끝 페이지는 시작 페이지보다 크거나 같아야 합니다.');
            return;
        }
        selectionMode = null;
        updateSelectionButtons();
        updateSelectionInfo();
        updateThumbnails();
    }
}

// 선택 버튼 상태 업데이트
function updateSelectionButtons() {
    if (selectionMode === 'start') {
        selectStartBtn.classList.add('active');
        selectEndBtn.classList.remove('active');
    } else if (selectionMode === 'end') {
        selectStartBtn.classList.remove('active');
        selectEndBtn.classList.add('active');
    } else {
        selectStartBtn.classList.remove('active');
        selectEndBtn.classList.remove('active');
    }
}

// 선택 정보 업데이트
function updateSelectionInfo() {
    if (selectionStart && selectionEnd) {
        selectedRange.textContent = `${selectionStart}페이지 ~ ${selectionEnd}페이지 (${selectionEnd - selectionStart + 1}페이지)`;
    } else if (selectionStart) {
        selectedRange.textContent = `${selectionStart}페이지 (끝 페이지 선택 필요)`;
    } else {
        selectedRange.textContent = '없음';
    }
}

// 썸네일 하이라이트 업데이트
function updateThumbnails() {
    const thumbnails = thumbnailList.querySelectorAll('.thumbnail-item');
    thumbnails.forEach((thumb, index) => {
        const pageNum = index + 1;
        thumb.classList.remove('selected-start', 'selected-end', 'selected-range');
        
        if (selectionStart && selectionEnd) {
            if (pageNum === selectionStart) {
                thumb.classList.add('selected-start');
            } else if (pageNum === selectionEnd) {
                thumb.classList.add('selected-end');
            } else if (pageNum > selectionStart && pageNum < selectionEnd) {
                thumb.classList.add('selected-range');
            }
        } else if (selectionStart && pageNum === selectionStart) {
            thumb.classList.add('selected-start');
        }
        
        if (pageNum === currentPage) {
            thumb.classList.add('current-page');
        } else {
            thumb.classList.remove('current-page');
        }
    });
}

// 범위 추가
function handleAddRange() {
    // 순서 검증
    if (!selectionStart) {
        alert('먼저 "시작 페이지" 버튼을 클릭하고 시작할 페이지를 선택해주세요.');
        return;
    }
    if (!selectionEnd) {
        alert('먼저 "마지막 페이지" 버튼을 클릭하고 끝낼 페이지를 선택해주세요.');
        return;
    }

    // 중복 체크
    const isDuplicate = splitRanges.some(range => 
        range.start === selectionStart && range.end === selectionEnd
    );

    if (isDuplicate) {
        alert('이미 추가된 범위입니다.');
        return;
    }

    splitRanges.push({ start: selectionStart, end: selectionEnd });
    updateRangesList();
    rangesList.style.display = 'block';
    splitRangesBtn.style.display = 'inline-block';
    
    // 선택 초기화
    selectionStart = null;
    selectionEnd = null;
    updateSelectionInfo();
    updateThumbnails();
}

// 범위 목록 업데이트
function updateRangesList() {
    rangesListItems.innerHTML = '';
    splitRanges.forEach((range, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="range-text">${range.start}페이지 ~ ${range.end}페이지 (${range.end - range.start + 1}페이지)</span>
            <button class="remove-range" onclick="removeRange(${index})">제거</button>
        `;
        rangesListItems.appendChild(li);
    });
}

// 범위 제거
function removeRange(index) {
    splitRanges.splice(index, 1);
    if (splitRanges.length === 0) {
        rangesList.style.display = 'none';
        splitRangesBtn.style.display = 'none';
    } else {
        updateRangesList();
    }
}

// 범위 분할 실행
async function handleSplitRanges() {
    // 순서 검증
    if (splitRanges.length === 0) {
        alert('먼저 "범위 추가" 버튼을 클릭하여 분할할 범위를 추가해주세요.');
        return;
    }

    try {
        await splitPdfByRanges(splitRanges);
    } catch (error) {
        console.error('분할 오류:', error);
        alert('PDF 분할 중 오류가 발생했습니다.');
    }
}

// 범위 배열로 PDF 분할
async function splitPdfByRanges(ranges) {
    splitResults = [];
    
    for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        const newPdf = await PDFLib.PDFDocument.create();
        const pageIndices = [];
        
        for (let page = range.start; page <= range.end; page++) {
            pageIndices.push(page - 1);
        }

        const copiedPages = await newPdf.copyPages(currentPdfDoc, pageIndices);
        copiedPages.forEach(page => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        splitResults.push({
            name: `범위_${range.start}-${range.end}.pdf`,
            url: url,
            pages: `${range.start}-${range.end}`,
            blob: blob,
            range: range
        });
    }

    displayResults();
    
    // 완료 팝업 표시
    showCompleteModal();
}

// 완료 모달 표시
function showCompleteModal() {
    completeFileCount.textContent = splitResults.length;
    completeModal.style.display = 'flex';
}

// 완료 모달 닫기
function closeCompleteModal() {
    completeModal.style.display = 'none';
}

// 완료 확인 핸들러
function handleConfirmComplete() {
    closeCompleteModal();
    // 결과 섹션으로 스크롤
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// 결과 표시
function displayResults() {
    resultList.innerHTML = '';
    
    splitResults.forEach((result, index) => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <div class="result-item-info">
                <div class="result-item-name">${result.name}</div>
                <div class="result-item-pages">${result.pages}페이지</div>
            </div>
            <div class="result-item-actions">
                <button class="btn-split-again" onclick="loadPdfFromResult(${index})">다시 분할</button>
                <button class="download-btn" onclick="downloadPdf(${index})">다운로드</button>
            </div>
        `;
        resultList.appendChild(div);
    });

    resultSection.style.display = 'block';
    
    // 히스토리에 추가
    addToHistory();
}

// PDF 다운로드
function downloadPdf(index) {
    const result = splitResults[index];
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// 전체 다운로드
function handleDownloadAll() {
    splitResults.forEach((result, index) => {
        setTimeout(() => {
            downloadPdf(index);
        }, index * 300);
    });
}

// 다시 분할하기
function handleSplitAgain() {
    resultSection.style.display = 'none';
    splitRanges = [];
    rangesList.style.display = 'none';
    splitRangesBtn.style.display = 'none';
    selectionStart = null;
    selectionEnd = null;
    selectionMode = null;
    updateSelectionButtons();
    updateSelectionInfo();
    updateThumbnails();
}

// 결과에서 PDF 로드 (다시 분할하기 위해)
async function loadPdfFromResult(index) {
    const result = splitResults[index];
    if (result && result.blob) {
        const file = new File([result.blob], result.name, { type: 'application/pdf' });
        await loadPdfFile(file);
        resultSection.style.display = 'none';
        previewSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// 히스토리에 추가
function addToHistory() {
    const historyItem = {
        timestamp: new Date().toLocaleString('ko-KR'),
        ranges: splitRanges,
        results: splitResults.map(r => r.name)
    };
    
    splitHistory.unshift(historyItem);
    if (splitHistory.length > 10) {
        splitHistory = splitHistory.slice(0, 10);
    }
    
    updateHistory();
}

// 히스토리 업데이트
function updateHistory() {
    if (splitHistory.length === 0) {
        historySection.style.display = 'none';
        return;
    }

    historySection.style.display = 'block';
    historyList.innerHTML = '';

    splitHistory.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-item-name">${item.timestamp}</div>
            <div class="history-item-info">
                범위: ${item.ranges && item.ranges.length > 0 ? item.ranges.map(r => `${r.start}-${r.end}`).join(', ') : '없음'}
            </div>
            <div class="history-item-info">
                결과: ${item.results.join(', ')}
            </div>
        `;
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => {
            showRestoreModal(item);
        });
        historyList.appendChild(div);
    });
}

// 복구 모달 표시
function showRestoreModal(historyItem) {
    if (!historyItem.ranges || historyItem.ranges.length === 0) {
        alert('이 히스토리 항목에는 복구할 범위 정보가 없습니다.');
        return;
    }
    
    restoreHistoryItem = historyItem;
    
        // 모달 정보 표시
    modalInfo.innerHTML = `
        <div class="modal-info-item">
            <strong>시간:</strong> ${historyItem.timestamp}
        </div>
        <div class="modal-info-item">
            <strong>범위:</strong> ${historyItem.ranges.map(r => `${r.start}-${r.end}페이지`).join(', ')} (총 ${historyItem.ranges.length}개)
        </div>
        <div class="modal-info-item">
            <strong>결과 파일:</strong> ${historyItem.results.join(', ')}
        </div>
    `;
    
    restoreModal.style.display = 'flex';
}

// 복구 모달 닫기
function closeRestoreModal() {
    restoreModal.style.display = 'none';
    restoreHistoryItem = null;
}

// 복구 확인
async function handleConfirmRestore() {
    if (!restoreHistoryItem || !restoreHistoryItem.ranges) {
        alert('복구할 정보가 없습니다.');
        return;
    }
    
    // 현재 선택 초기화
    selectionStart = null;
    selectionEnd = null;
    selectionMode = null;
    
    // 히스토리의 범위로 복구
    splitRanges = restoreHistoryItem.ranges.map(range => ({ ...range }));
    
    // UI 업데이트
    updateRangesList();
    rangesList.style.display = 'block';
    splitRangesBtn.style.display = 'inline-block';
    updateSelectionButtons();
    updateSelectionInfo();
    updateThumbnails();
    
    // 모달 닫기
    closeRestoreModal();
    
    // 자동으로 분할 실행
    try {
        await splitPdfByRanges(splitRanges);
        // 결과 섹션으로 스크롤
        resultSection.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('분할 오류:', error);
        alert('PDF 분할 중 오류가 발생했습니다.');
    }
}

// 파일 제거 핸들러
function handleRemoveFile() {
    currentPdfDoc = null;
    currentPdfBytes = null;
    pdfJsDoc = null;
    totalPages = 0;
    splitRanges = [];
    splitResults = [];
    selectionStart = null;
    selectionEnd = null;
    selectionMode = null;
    currentPage = 1;

    fileInfo.style.display = 'none';
    previewSection.style.display = 'none';
    resultSection.style.display = 'none';
    rangesList.style.display = 'none';
    fileInput.value = '';
    thumbnailList.innerHTML = '';
}

// 전역 함수로 내보내기
window.removeRange = removeRange;
window.downloadPdf = downloadPdf;
window.loadPdfFromResult = loadPdfFromResult;