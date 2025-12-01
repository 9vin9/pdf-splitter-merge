# 코드 난독화 가이드

## ⚠️ 중요 안내

**완전히 코드를 숨기는 것은 불가능합니다.** 클라이언트 사이드 JavaScript는 브라우저에 다운로드되어 실행되기 때문에, 결국 코드를 볼 수 있습니다. 하지만 난독화를 통해 코드를 읽기 어렵게 만들 수 있습니다.

## 현재 적용된 보호 기능

1. ✅ 개발자 도구 열기 방지 (F12, Ctrl+Shift+I 등)
2. ✅ 우클릭 방지
3. ✅ 텍스트 선택 방지
4. ✅ 소스 보기 방지 (Ctrl+U)
5. ✅ 개발자 도구 감지 및 경고

## 추가 난독화 방법

### 방법 1: 온라인 난독화 도구 사용 (추천)

1. **JavaScript Obfuscator** (https://obfuscator.io/)
   - `script.js` 파일을 업로드
   - 난독화 옵션 설정
   - 난독화된 코드를 다운로드하여 `script.js` 교체

2. **UglifyJS** (https://skalman.github.io/UglifyJS-online/)
   - 코드 압축 및 난독화

### 방법 2: Node.js를 사용한 난독화

```bash
# javascript-obfuscator 설치
npm install -g javascript-obfuscator

# script.js 난독화
javascript-obfuscator script.js --output script.obfuscated.js --compact true --control-flow-flattening true

# merge-script.js 난독화
javascript-obfuscator merge-script.js --output merge-script.obfuscated.js --compact true --control-flow-flattening true
```

### 방법 3: 빌드 도구 사용

Webpack, Rollup 등의 번들러를 사용하여 코드를 번들링하고 난독화할 수 있습니다.

## 주의사항

1. **난독화 후 테스트 필수**: 난독화된 코드가 정상 작동하는지 반드시 테스트하세요.
2. **원본 코드 백업**: 난독화 전 원본 코드를 반드시 백업하세요.
3. **성능 영향**: 난독화는 코드 크기를 증가시킬 수 있으며, 약간의 성능 저하가 있을 수 있습니다.
4. **완전한 보호 불가능**: 숙련된 개발자는 여전히 코드를 분석할 수 있습니다.

## 권장 작업 순서

1. 현재 `protect.js`가 이미 적용되어 있습니다.
2. `script.js`와 `merge-script.js`를 난독화합니다.
3. 난독화된 파일로 교체합니다.
4. 모든 기능이 정상 작동하는지 테스트합니다.

