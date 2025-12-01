// 개발자 도구 및 코드 보호 스크립트
(function() {
    'use strict';
    
    // 개발자 도구 감지 및 방지
    let devtools = {open: false, orientation: null};
    const threshold = 160;
    let warningCount = 0;
    const maxWarnings = 3;
    
    // 개발자 도구 감지 함수
    function checkDevTools() {
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
            if (!devtools.open) {
                devtools.open = true;
                warningCount++;
                if (warningCount <= maxWarnings) {
                    alert('개발자 도구 사용이 감지되었습니다. 코드 보호를 위해 페이지가 닫힐 수 있습니다.');
                } else {
                    window.location.href = 'about:blank';
                }
            }
        } else {
            devtools.open = false;
        }
    }
    
    setInterval(checkDevTools, 500);
    
    // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U 등 키 조합 방지
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.keyCode === 123) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        // Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        // Ctrl+Shift+J
        if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        // Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        // Ctrl+U (소스 보기)
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        // Ctrl+S (페이지 저장) - PDF 다운로드 기능과 충돌할 수 있으므로 주석 처리
        // if (e.ctrlKey && e.keyCode === 83) {
        //     e.preventDefault();
        //     e.stopPropagation();
        //     return false;
        // }
    }, true);
    
    // 우클릭 방지
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    }, true);
    
    // 텍스트 선택 방지 (일부 요소는 제외)
    document.addEventListener('selectstart', function(e) {
        // input, textarea는 허용
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return true;
        }
        e.preventDefault();
        return false;
    }, true);
    
    // 드래그 방지 (파일 업로드 드래그는 허용)
    document.addEventListener('dragstart', function(e) {
        // 파일 업로드 영역은 제외
        if (e.target.closest('.upload-area')) {
            return true;
        }
        e.preventDefault();
        return false;
    }, true);
    
    // 콘솔 경고 메시지
    const originalLog = console.log;
    console.log = function() {
        // 콘솔 사용 시도 감지
        if (arguments[0] && typeof arguments[0] === 'string' && !arguments[0].includes('경고')) {
            warningCount++;
        }
        originalLog.apply(console, arguments);
    };
    
    console.log('%c⚠️ 경고!', 'color: red; font-size: 50px; font-weight: bold;');
    console.log('%c이 콘솔은 보안상의 이유로 사용할 수 없습니다.', 'color: red; font-size: 20px;');
    console.log('%c코드를 복사하거나 수정하려는 시도는 감지됩니다.', 'color: red; font-size: 16px;');
    
    // 디버거 방지 (간헐적으로 실행)
    function detectDebugger() {
        const start = performance.now();
        try {
            eval('debugger;');
        } catch(e) {}
        const end = performance.now();
        if (end - start > 100) {
            warningCount++;
            if (warningCount > maxWarnings) {
                window.location.href = 'about:blank';
            }
        }
    }
    
    // 디버거 감지를 랜덤하게 실행 (너무 자주 실행하면 성능 저하)
    setInterval(function() {
        if (Math.random() > 0.7) {
            detectDebugger();
        }
    }, 2000);
    
    // 개발자 도구 콘솔 감지 (더미 객체)
    let devtoolsDetector = {};
    Object.defineProperty(devtoolsDetector, 'id', {
        get: function() {
            warningCount++;
            if (warningCount > maxWarnings) {
                window.location.href = 'about:blank';
            }
        }
    });
    
    // 주기적으로 더미 객체 접근 시도
    setInterval(function() {
        try {
            const _ = devtoolsDetector.id;
        } catch(e) {}
    }, 1000);
    
})();

