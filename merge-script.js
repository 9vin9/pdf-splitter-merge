// PDF.js 워커 설정

pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';


// 전역 변수

let uploadedFiles = []; // { file, name, pages, id, pdfJsDoc }



// DOM 요소

const uploadArea = document.getElementById('uploadArea');

const fileInput = document.getElementById('fileInput');

const filesSection = document.getElementById('filesSection');

const filesList = document.getElementById('filesList');

const clearAllBtn = document.getElementById('clearAllBtn');

const mergeBtn = document.getElementById('mergeBtn');

const resultSection = document.getElementById('resultSection');

const resultFileName = document.getElementById('resultFileName');

const resultPages = document.getElementById('resultPages');

const downloadBtn = document.getElementById('downloadBtn');

const mergeAgainBtn = document.getElementById('mergeAgainBtn');

const closeGuideBtn = document.getElementById('closeGuideBtn');

const previewModal = document.getElementById('previewModal');

const closePreviewModalBtn = document.getElementById('closePreviewModalBtn');

const closePreviewBtn = document.getElementById('closePreviewBtn');

const previewModalFileName = document.getElementById('previewModalFileName');

const previewModalCanvas = document.getElementById('previewModalCanvas');



let mergedPdfBlob = null;

let draggedElement = null;

let currentPreviewFileId = null;

let isDragging = false; // 전역 드래그 상태



// 이벤트 리스너

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', handleDragOver);

uploadArea.addEventListener('dragleave', handleDragLeave);

uploadArea.addEventListener('drop', handleDrop);

fileInput.addEventListener('change', handleFileSelect);

clearAllBtn.addEventListener('click', handleClearAll);

mergeBtn.addEventListener('click', handleMerge);

downloadBtn.addEventListener('click', handleDownload);

mergeAgainBtn.addEventListener('click', handleMergeAgain);

closeGuideBtn.addEventListener('click', () => {

document.querySelector('.usage-guide').style.display = 'none';

});

closePreviewModalBtn.addEventListener('click', closePreviewModal);

closePreviewBtn.addEventListener('click', closePreviewModal);



// 미리보기 모달 외부 클릭 시 닫기

previewModal.addEventListener('click', (e) => {

if (e.target === previewModal) {

closePreviewModal();

}

});



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

const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');

if (files.length > 0) {

handleFiles(files);

} else {

alert('PDF 파일만 업로드할 수 있습니다.');

}

}



// 파일 선택 핸들러

function handleFileSelect(e) {

const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf');

if (files.length > 0) {

handleFiles(files);

} else {

alert('PDF 파일만 업로드할 수 있습니다.');

}

}



// 파일 처리

async function handleFiles(files) {

for (const file of files) {

await addFile(file);

}

updateFilesList();

filesSection.style.display = 'block';

fileInput.value = ''; // 같은 파일을 다시 선택할 수 있도록

}



// 파일 추가

async function addFile(file) {

try {

// 파일을 한 번만 읽고 Uint8Array로 저장 (재사용 가능)

const arrayBuffer = await file.arrayBuffer();

const uint8Array = new Uint8Array(arrayBuffer);


// 페이지 수 확인

const pdfDoc = await PDFLib.PDFDocument.load(uint8Array);

const pageCount = pdfDoc.getPageCount();


// PDF.js로 로드 (미리보기용)

let pdfJsDoc = null;

try {

// Uint8Array를 완전히 복사해서 사용 (독립적인 복사본)

const uint8ArrayForPreview = new Uint8Array(uint8Array.length);

uint8ArrayForPreview.set(uint8Array);

const loadingTask = pdfjsLib.getDocument({ data: uint8ArrayForPreview });

pdfJsDoc = await loadingTask.promise;

} catch (pdfJsError) {

console.warn('PDF.js 로드 실패 (미리보기 불가):', pdfJsError);

// PDF.js 로드 실패해도 병합은 가능하도록 계속 진행

}


const fileId = Date.now() + Math.random();

uploadedFiles.push({

id: fileId,

file: file,

name: file.name,

pages: pageCount,

uint8Array: uint8Array, // Uint8Array로 저장 (재사용 가능)

pdfJsDoc: pdfJsDoc

});

} catch (error) {

console.error('파일 로드 오류:', error);

alert(`파일 "${file.name}"을 로드하는 중 오류가 발생했습니다: ${error.message}`);

}

}



// 파일 목록 업데이트

function updateFilesList() {

filesList.innerHTML = '';


uploadedFiles.forEach((fileData, index) => {

const fileItem = document.createElement('div');

fileItem.className = 'file-item';

fileItem.draggable = true;

fileItem.dataset.index = index;

fileItem.dataset.id = fileData.id;


// 썸네일 캔버스 생성

const thumbnailCanvas = document.createElement('canvas');

thumbnailCanvas.className = 'file-thumbnail';

thumbnailCanvas.dataset.fileId = fileData.id;


fileItem.innerHTML = `

<div class="file-item-handle">

<svg class="drag-handle" viewBox="0 0 24 24" fill="none" stroke="currentColor">

<circle cx="9" cy="5" r="1"></circle>

<circle cx="9" cy="12" r="1"></circle>

<circle cx="9" cy="19" r="1"></circle>

<circle cx="15" cy="5" r="1"></circle>

<circle cx="15" cy="12" r="1"></circle>

<circle cx="15" cy="19" r="1"></circle>

</svg>

</div>

<div class="file-thumbnail-container"></div>

<div class="file-item-info">

<div class="file-item-name">${fileData.name}</div>

<div class="file-item-pages">${fileData.pages}페이지</div>

</div>

<div class="file-item-number">${index + 1}</div>

<button class="btn-remove-file" onclick="removeFile('${fileData.id}')">×</button>

`;


// 썸네일 컨테이너에 캔버스 추가

const thumbnailContainer = fileItem.querySelector('.file-thumbnail-container');

thumbnailContainer.appendChild(thumbnailCanvas);


// 썸네일 렌더링

renderThumbnail(fileData, thumbnailCanvas);


// 썸네일 클릭 이벤트 (팝업으로 미리보기)

thumbnailCanvas.style.cursor = 'pointer';

thumbnailCanvas.addEventListener('click', (e) => {

e.preventDefault();

e.stopPropagation();

showPreviewModal(fileData.id);

});


// 드래그 이벤트

fileItem.addEventListener('dragstart', (e) => {

isDragging = true;

handleDragStart.call(fileItem, e);

});

fileItem.addEventListener('dragover', handleItemDragOver);

fileItem.addEventListener('drop', handleItemDrop);

fileItem.addEventListener('dragend', (e) => {

handleDragEnd.call(fileItem, e);

setTimeout(() => { isDragging = false; }, 200);

});



filesList.appendChild(fileItem);

});

}



// 드래그 시작

function handleDragStart(e) {

draggedElement = this;

this.classList.add('dragging');

e.dataTransfer.effectAllowed = 'move';

e.dataTransfer.setData('text/html', this.innerHTML);

}



// 드래그 오버

function handleItemDragOver(e) {

if (e.preventDefault) {

e.preventDefault();

}


const targetItem = this.closest('.file-item');

if (draggedElement && targetItem !== draggedElement) {

const allItems = filesList.querySelectorAll('.file-item');

let insertBefore = null;


for (let i = 0; i < allItems.length; i++) {

const item = allItems[i];

const rect = item.getBoundingClientRect();

const midpoint = rect.top + rect.height / 2;


if (e.clientY < midpoint) {

insertBefore = item;

break;

}

}


if (insertBefore) {

filesList.insertBefore(draggedElement, insertBefore);

} else {

filesList.appendChild(draggedElement);

}

}


return false;

}



// 드롭

function handleItemDrop(e) {

if (e.stopPropagation) {

e.stopPropagation();

}


return false;

}



// 드래그 종료

function handleDragEnd(e) {

this.classList.remove('dragging');


// 순서 재정렬

const items = Array.from(filesList.querySelectorAll('.file-item'));

const newOrder = items.map(item => {

const id = item.dataset.id;

return uploadedFiles.find(f => f.id.toString() === id);

}).filter(f => f !== undefined);


uploadedFiles = newOrder;

updateFilesList();



draggedElement = null;

}



// 썸네일 렌더링

async function renderThumbnail(fileData, canvas) {

if (!fileData.pdfJsDoc) {

return;

}


try {

const page = await fileData.pdfJsDoc.getPage(1);

const viewport = page.getViewport({ scale: 0.2 }); // 작은 썸네일


canvas.width = viewport.width;

canvas.height = viewport.height;


const context = canvas.getContext('2d');

await page.render({

canvasContext: context,

viewport: viewport

}).promise;

} catch (error) {

console.error('썸네일 렌더링 오류:', error);

}

}



// 팝업으로 미리보기 표시

async function showPreviewModal(fileId) {

const fileData = uploadedFiles.find(f => f.id.toString() === fileId);

if (!fileData) {

return;

}


if (!fileData.pdfJsDoc) {

alert('미리보기를 불러올 수 없습니다. 파일을 다시 업로드해주세요.');

return;

}


previewModalFileName.textContent = fileData.name;

previewModal.style.display = 'flex';


try {

// 첫 페이지 렌더링

const page = await fileData.pdfJsDoc.getPage(1);

const container = document.querySelector('.preview-container-large');

if (!container) {

console.error('미리보기 컨테이너를 찾을 수 없습니다.');

return;

}


// 컨테이너 너비 계산

const containerWidth = Math.max(container.clientWidth - 40, 600);

const viewport = page.getViewport({ scale: 1 });

const scale = Math.min(containerWidth / viewport.width, 2.0); // 최대 2배 확대

const scaledViewport = page.getViewport({ scale: scale });


// DPI 고려한 해상도 설정

const dpr = window.devicePixelRatio || 1;

previewModalCanvas.width = scaledViewport.width * dpr;

previewModalCanvas.height = scaledViewport.height * dpr;

previewModalCanvas.style.width = scaledViewport.width + 'px';

previewModalCanvas.style.height = scaledViewport.height + 'px';


const context = previewModalCanvas.getContext('2d');

context.scale(dpr, dpr);

context.clearRect(0, 0, scaledViewport.width, scaledViewport.height);


await page.render({

canvasContext: context,

viewport: scaledViewport

}).promise;

} catch (error) {

console.error('미리보기 렌더링 오류:', error);

alert(`미리보기를 표시하는 중 오류가 발생했습니다: ${error.message}`);

}

}



// 팝업 닫기

function closePreviewModal() {

previewModal.style.display = 'none';

}



// 파일 제거

function removeFile(fileId) {

uploadedFiles = uploadedFiles.filter(f => f.id.toString() !== fileId);

if (uploadedFiles.length === 0) {

filesSection.style.display = 'none';

previewModal.style.display = 'none';

} else {

updateFilesList();

// 현재 미리보기 중인 파일이 삭제되면 팝업 닫기

if (currentPreviewFileId === fileId) {

closePreviewModal();

currentPreviewFileId = null;

}

}

}



// 전체 삭제

function handleClearAll() {

if (uploadedFiles.length > 0 && confirm('모든 파일을 삭제하시겠습니까?')) {

uploadedFiles = [];

filesSection.style.display = 'none';

resultSection.style.display = 'none';

previewModal.style.display = 'none';

mergedPdfBlob = null;

currentPreviewFileId = null;

}

}



// 병합 실행

async function handleMerge() {

if (uploadedFiles.length === 0) {

alert('병합할 파일을 업로드하세요.');

return;

}


if (uploadedFiles.length === 1) {

alert('병합하려면 최소 2개 이상의 파일이 필요합니다.');

return;

}


try {

mergeBtn.disabled = true;

mergeBtn.textContent = '병합 중...';


const mergedPdf = await PDFLib.PDFDocument.create();

let totalPages = 0;


for (const fileData of uploadedFiles) {

// 저장된 Uint8Array를 완전히 복사해서 사용 (detached 방지)

const uint8ArrayCopy = new Uint8Array(fileData.uint8Array.length);

uint8ArrayCopy.set(fileData.uint8Array);

const sourcePdf = await PDFLib.PDFDocument.load(uint8ArrayCopy);

const pages = await mergedPdf.copyPages(sourcePdf,

Array.from({ length: sourcePdf.getPageCount() }, (_, i) => i)

);


pages.forEach(page => mergedPdf.addPage(page));

totalPages += sourcePdf.getPageCount();

}


const pdfBytes = await mergedPdf.save();

mergedPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });


// 결과 표시

resultFileName.textContent = 'merged.pdf';

resultPages.textContent = `총 ${totalPages}페이지`;

resultSection.style.display = 'block';

resultSection.scrollIntoView({ behavior: 'smooth' });


} catch (error) {

console.error('병합 오류:', error);

alert(`PDF 병합 중 오류가 발생했습니다: ${error.message || error}`);

} finally {

mergeBtn.disabled = false;

mergeBtn.textContent = '병합 실행';

}

}



// 다운로드

function handleDownload() {

if (mergedPdfBlob) {

const url = URL.createObjectURL(mergedPdfBlob);

const a = document.createElement('a');

a.href = url;

a.download = 'merged.pdf';

document.body.appendChild(a);

a.click();

document.body.removeChild(a);

URL.revokeObjectURL(url);

}

}



// 다시 병합하기

function handleMergeAgain() {

resultSection.style.display = 'none';

mergedPdfBlob = null;

}



// 전역 함수

window.removeFile = removeFile;