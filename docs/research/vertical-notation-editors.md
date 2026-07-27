# 세로셈(Vertical/Column Arithmetic) 웹 표현·편집 기술 리서치

- 작성일: 2026-07-28
- 대상: Mathemagics(Arthur Benjamin) 기반 어린이 암산 학습 앱
- 제약: GitHub Pages 정적 사이트(서버 없음), 어린이 UX 최우선, 번들 경량

## TL;DR

세로셈(받아올림 덧셈, 받아내림 뺄셈, 곱셈 부분곱, 나눗셈 브래킷)을 웹에서 표현하는 **표준 기술은 사실상 없다.**
MathML의 초등수학 요소(`<mstack>`, `<mscarries>`, `<mlongdiv>`)는 MathML Core에서 제외되어 2026년 현재 어떤 브라우저도 네이티브 지원하지 않고, KaTeX/MathJax도 정식 지원이 없다.
따라서 **"자릿수 1개 = 그리드 셀 1개"인 커스텀 HTML/CSS Grid 컴포넌트**가 렌더링·입력·애니메이션·접근성 모두에서 최선이며, 실제 상용 연산 연습 서비스(Math Mammoth 등)도 전부 이 방식이다.

---

## 1. 표기/렌더링(Notation/Rendering) 기술 평가

### 1.1 MathML Core + 초등수학 확장 — 2026년 실태

| 항목 | 상태 |
|---|---|
| MathML Core 자체 | Chrome 109+(2023.1, Igalia 구현), Firefox, Safari 모두 지원. 크로스 브라우저 네이티브 수식 렌더링 가능 ([caniuse](https://caniuse.com/mathml), [Igalia 프로젝트](https://mathml.igalia.com/project/)) |
| `<mstack>` `<mscarries>` `<msgroup>` `<mlongdiv>` | **MathML Core에서 제외.** Core 스펙에 없는 요소는 "Unknown MathML element"로 취급 → **Chrome/Firefox/Safari 모두 렌더링 안 됨** ([MathML Core 스펙](https://w3c.github.io/mathml-core/), [MathML 4 Full](https://www.w3.org/TR/mathml4/) §3.6은 "future Core에 편입될 수도"라는 수준) |
| 폴리필 | [w3c/mathml-polyfills](https://github.com/w3c/mathml-polyfills)에 `elem-math` 폴리필 존재(MIT). 단 star 25개, 릴리스 없음, 활성도 낮음 — 프로덕션 의존은 위험 |

- 받아올림/취소선: `<mscarries>`가 carry 표기와 crossout(사선) 속성을 스펙상 정의하지만 **구현체가 없음**.
- 접근성: MathML Core 자체는 스크린리더 지원이 좋아지는 추세지만, 폴리필로 그린 elementary math는 보장 없음 ([MathML Accessibility Gap Analysis](https://w3c.github.io/mathml-docs/gap-analysis/)).
- 결론: **후보 탈락.** 표준의 방향은 맞지만 2026년 기준 실사용 불가.

### 1.2 MathJax v4 vs KaTeX

| 항목 | MathJax v4 | KaTeX |
|---|---|---|
| 초등수학(`mstack` 등) | **실험적(experimental)** — `mml3` 확장이 XSLT 변환으로 일반 presentation MathML로 근사 렌더링. v2.6부터 v4까지 계속 "experimental" 딱지 ([MathJax v4 MathML 문서](https://docs.mathjax.org/en/v4.0/input/mathml.html)) | **미지원.** long division 이슈 [#1319](https://github.com/KaTeX/KaTeX/issues/1319)는 2018년부터 Backlog에 방치 |
| 나눗셈 브래킷 | v2용 서드파티 확장 [pkra/mathjax-extension-longdiv](https://github.com/pkra/mathjax-extension-longdiv) (`\longdiv` 매크로, v4 미이식) | `\overline{\smash{\big)}...}` + `array` 환경 수작업 트릭 ([예시 블로그](https://learnsharewithdp.wordpress.com/2020/05/19/how-to-write-long-division-in-latex/)) |
| carry/borrow, 취소선 | mml3 근사 or `array` 수작업 | `array` + `\scriptstyle` 숫자 + `\cancel` 수작업 |
| LaTeX 연산 패키지(xlop, longdivision) | **둘 다 실행 불가.** [xlop](https://ctan.org/pkg/xlop)은 TeX 프로그래밍(컴파일 타임 연산) 기반이라 MathJax/KaTeX 같은 "표기 서브셋" 구현체에서 동작하지 않음. 브라우저에서 쓰려면 실제 LaTeX 컴파일 후 SVG/HTML 내보내기 필요 | 동일 |
| 단계별 하이라이트/애니메이션 | 렌더 결과가 통짜 span 트리 → 셀 단위 제어 어려움 | 동일 |
| 접근성 | 강점: speech 문자열을 `aria-label`로 자동 삽입, explorer 내장 ([MathJax a11y](https://docs.mathjax.org/en/latest/basic/accessibility.html)) | 약함(별도 처리 필요) |
| 번들 | tex-chtml 기준 수백 KB~1MB급 + 폰트 | JS ~277KB min + CSS + 폰트 (더 가볍고 빠름) |

- 결론: 인라인 수식(예: 좌→우 암산 과정의 가로 수식 표기)에는 KaTeX가 유용하지만, **세로셈 본체의 렌더링/편집 도구로는 둘 다 부적합.** "각 자릿수를 개별 DOM 노드로 잡고 하이라이트·클릭·입력"하는 요구와 근본적으로 안 맞는다.

### 1.3 커스텀 HTML/CSS Grid (자릿수 1개 = 셀 1개) — 사실상의 업계 표준

실제 서비스 사례(모두 per-cell 방식):

- [Math Mammoth 온라인 long division 연습](https://www.mathmammoth.com/practice/long-division) — 종이처럼 그리드에 숫자를 쓰고, "Check" 시 틀린 자릿수는 빨강/맞으면 초록 즉시 피드백. 자릿수 난이도 설정.
- [The Great Martini Company](http://www.thegreatmartinicompany.com/longarithmetic/longdivision.html) — 음영 처리된 블록이 "다음 입력 위치"를 안내, 화살표 키/마우스로 셀 이동, 정답 파랑·오답 빨강.
- [free-training-tutorial long division games](https://free-training-tutorial.com/long-division-games.html) — 깜빡이는 커서가 다음 입력 자리를 유도, 셀 클릭으로 수정.
- [Transum column method](https://www.transum.org/Maths/Exercise/Column_Method/Division_Long.asp) — 중간중간 자주 Check 유도.

핵심 CSS 기법:

- `display: grid` + `grid-column`으로 자릿값(place value)별 열 배치 — carry 행, 피연산자 행, 부분곱 행, 답 행을 같은 열 트랙에 정렬 ([MDN grid-column](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/grid-column)).
- `font-variant-numeric: tabular-nums`로 모든 숫자 폭 통일 — 자릿수 정렬의 필수 조건 ([CSSence: character-based alignment](https://cssence.com/2024/text-align-decimal/)).
- 취소선(borrow): 셀에 `position:relative` + `::after`로 대각선(`transform: rotate(-45deg)` 또는 인라인 SVG line) — `text-decoration: line-through`보다 "손으로 그은 사선" 느낌.
- 나눗셈 브래킷: 몫 행 아래 `border-bottom` + 제수와 피제수 사이에 곡선용 소형 SVG(또는 `border-left` + `border-radius`). 한국식 ⟌ 모양은 SVG 한 조각이면 충분.
- 평가: 브라우저 지원 100%, 셀 단위 하이라이트/애니메이션/클릭 자유, 번들 0KB(프레임워크 제외), 접근성은 직접 설계(1.5절). **유일한 단점 = 직접 만들어야 함.** 단, 도메인이 사칙연산 4종으로 좁아 부담이 작다.

### 1.4 SVG / Canvas

- SVG: 브래킷·사선·화살표 등 **장식 요소**에 최적. 텍스트까지 SVG로 그리면 반응형 폰트 크기·접근성·입력 처리가 모두 어려워짐.
- Canvas: 접근성 최악(DOM 없음), 입력 셀 구현 부적합. 손글씨 잉크 스트로크 캡처용으로만 의미 있음.
- 결론: **HTML Grid 본체 + SVG 장식**의 하이브리드가 정답. 전체 SVG/Canvas 렌더링은 비추천.

### 1.5 접근성(스크린리더) 공통 지침

- 커스텀 그리드는 각 셀에 `aria-label`("십의 자리 받아올림 1", "일의 자리 답 칸")을 부여하고, **DOM 순서 = 풀이 순서**로 유지(CSS Grid 시각 재배치는 낭독 순서를 못 바꿈, [MDN Grid a11y](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Accessibility)).
- 진입 시 레이아웃 구조("3행 4열, 위에서부터 받아올림·피연산자·답") 안내 후 탐색 유도 ([Perkins School 그리드 학습 지침](https://www.perkins.org/resource/digital-transitions-2-math-grid-activities/)).
- 학생 입력을 실시간으로 낭독 문자열로 변환해 aria-label로 재주입하는 Learnosity 패턴 참고 ([Learnosity math a11y](https://help.learnosity.com/hc/en-us/articles/360000758037-Accessibility-for-Math-Content)).
- 정답/오답·다음 단계 안내는 `aria-live="polite"` 영역으로.

---

## 2. 입력/에디터(Input/Editor) 접근

### 2.1 범용 수식 에디터

| 도구 | 세로셈 지원 | 평가 |
|---|---|---|
| [MathLive](https://github.com/arnog/mathlive) `<math-field>` | **전용 기능 없음.** `array` 환경 + readonly `\placeholder`(fill-in-the-blank)로 흉내 가능하나, 행렬 편집 UX가 어린이에게 부적합(단축키 의존, [#2156](https://github.com/arnog/mathlive/issues/2156)) | 가상 키보드·MathJSON 내장은 매력적이지만 무겁고(수백 KB+폰트), carry/취소선/브래킷 표현 불가 |
| MathQuill | 없음 (한 줄 수식 편집기, 유지보수 정체) | 탈락 |
| Desmos math input | 세로셈 미지원 + **프로덕션 API 키는 파트너십 문의 필요**(무료 보장 없음) | 탈락 |

결론: 범용 수식 에디터는 세로셈 문제를 풀지 못한다. 이 도구들은 "수식 한 줄"의 편집기이고, 세로셈은 "좌표가 있는 표"이기 때문.

### 2.2 커스텀 digit-cell 에디터 (권장)

1.3절 사례들에서 추출한 검증된 UX 패턴:

1. **활성 셀 강조** — 음영/깜빡이는 커서로 "다음에 쓸 곳"을 항상 1곳만 보여줌 (Great Martini, free-training-tutorial).
2. **자동 전진(auto-advance)** — 한 자리 입력 시 다음 셀로 포커스 이동. 벤저민식(좌→우)과 학교식(우→좌)은 전진 방향만 다름.
3. **셀 단위 즉시 피드백** — 초록/빨강. 문제 끝이 아니라 중간에도 Check 가능 (Math Mammoth, Transum).
4. **가상 넘패드(virtual numpad)** — 0–9 + 지우기 + "받아올림 토글" 버튼. 태블릿에서 OS 키보드는 화면 절반을 가리므로 필수. 큰 터치 타깃(≥48px).
5. **클릭/탭으로 임의 셀 수정 허용** — 되돌리기 부담을 없애 실수 공포를 줄임.
6. 구현: 셀은 `<input inputmode="numeric" maxlength="1">` 또는 numpad 전용이면 `<button role="gridcell">`/`contenteditable` 없이 상태 기반 렌더링. 키보드 사용자용 화살표 이동 + 물리 숫자키 입력 병행.

### 2.3 손글씨 입력 — 정적 무료 사이트에서는 보류

| 서비스 | 실태 (2026) | 정적 GitHub Pages 적합성 |
|---|---|---|
| [MyScript iinkTS](https://github.com/MyScript/iinkTS) | 클라우드 인식(월 무료 쿼터, 정확 수치는 developer.myscript.com 확인 필요). 2026.1 iink SDK 4.3에서 인식 엔진 대폭 개선 | **부적합.** API 키가 클라이언트에 노출되고, 쿼터 초과 시 유료. 교육용 라이선스도 시트당 연 €12~ |
| [Mathpix](https://mathpix.com/pricing/api) | **상시 무료 티어 없음.** 셋업 $19.99 + 이미지당 $0.002, strokes 세션 과금 | 부적합(비용 + 키 노출) |
| Google Handwriting | 공개 웹 API 아님(Input Tools는 비공식) | 부적합 |
| 대안: 온디바이스 숫자 인식 | 0–9 숫자 10종만 인식하면 되므로 TF.js/ONNX 초소형 CNN(MNIST급, 수십 KB) 또는 $P/$1 제스처 인식기를 셀 위 캔버스에 얹는 방식은 실현 가능 | 가능하나 **v2 과제**로. 인식 오류는 어린이에게 최악의 UX이므로 numpad를 기본으로 |

---

## 3. 단계별 공개(Step Reveal)·애니메이션

### 3.1 패턴

- **스텝 상태 기계**: 문제 = 스텝 배열(4.절 스키마). "현재 스텝 인덱스" 하나로 이전/다음/자동재생을 전부 구현. 애니메이션은 스텝 전환의 부수 효과로만.
- **열(column) 하이라이트**: 현재 계산 중인 자릿값 열 전체에 배경색 → 어디를 보는지 시선 유도.
- **carry 팝인**: 받아올림 숫자는 해당 열 상단 셀에 scale+fade로 등장(150–250ms). 받아내림은 취소선 사선을 SVG `stroke-dashoffset`으로 긋기.
- **좌→우(벤저민식) vs 우→좌(학교식)**: 렌더링 구조는 동일, **스텝 배열의 순서만 다르다.** 벤저민식은 "623+159 → 백의 자리부터 723, 773, 782"처럼 중간 합 전체가 갱신되는 표현(가로 수식 + 러닝 토탈)이 세로셈보다 자연스러운 경우가 많으므로, 세로셈 뷰와 러닝 토탈 뷰를 모두 스텝 데이터에서 파생시킬 것 ([Benjamin, Secrets of Mental Math](https://plus.thegreatcourses.com/the-secrets-of-mental-math)).
- `prefers-reduced-motion` 존중(즉시 표시로 대체).

### 3.2 라이브러리 선택

| 라이브러리 | 크기(min+gzip) | 라이선스 | 평가 |
|---|---|---|---|
| CSS transitions/animations | 0KB | — | 셀 하이라이트·팝인·색 변화의 90%는 이걸로 충분. **1순위** |
| [Motion](https://motion.dev/docs/react-reduce-bundle-size) `animate()` mini | ~2.3–5KB (WAAPI 기반) | MIT | 시퀀싱·스프링이 필요할 때. **2순위** |
| GSAP | ~23KB+ (코어) | [2025.4부터 전 플러그인 포함 100% 무료](https://webflow.com/blog/gsap-becomes-free) | 강력하지만 이 앱 규모엔 과함. SVG 사선 긋기 등 필요 시에만 |
| Framer Motion(전체 `motion` 컴포넌트) | ~34KB | MIT | React 채택 시에도 `LazyMotion`(~4.6KB) 또는 mini로 축소 권장 |

---

## 4. 데이터 포맷: 문제 + 스텝 시퀀스 JSON 스키마

### 후보 A — 시맨틱 스키마 (권장 기본)

문제의 의미만 저장하고, **스텝은 런타임 엔진이 생성**. 문제 데이터가 작고, 방식(벤저민/학교식) 전환이 필드 하나로 끝난다.

```json
{
  "id": "add-2d-carry-001",
  "op": "add",                     // add | sub | mul | div
  "operands": [348, 257],
  "method": "ltr",                 // ltr(벤저민식) | rtl(학교식)
  "level": 2,
  "hints": { "ko": "백의 자리부터 더해 보자!" }
}
```

엔진이 위 데이터에서 아래(후보 B 형태)의 스텝 배열을 파생: `deriveSteps(problem) -> Step[]`. 덧셈/뺄셈/곱셈은 결정적 알고리즘이므로 파생이 쉽고, 테스트도 순수 함수 단위로 가능.

### 후보 B — 셀 좌표 + 스텝 명시 스키마 (파생 결과물이자, 비정형 레이아웃용 escape hatch)

나눗셈처럼 레이아웃이 문제마다 다르거나, 저자가 손으로 특수한 연출을 지정하고 싶을 때 직접 작성.

```json
{
  "grid": {
    "cols": 5,                       // 자릿값 열 수(부호/연산자 열 포함)
    "rows": [
      { "id": "carry",   "cells": { } },
      { "id": "op1",     "cells": { "c2": "3", "c3": "4", "c4": "8" } },
      { "id": "op2",     "cells": { "c1": "+", "c2": "2", "c3": "5", "c4": "7" }, "underline": true },
      { "id": "answer",  "cells": { }, "input": true }
    ]
  },
  "steps": [
    { "t": "highlight", "col": "c4", "narration": { "ko": "일의 자리: 8 + 7" } },
    { "t": "write",  "cell": "answer.c4", "value": "5", "expect": true },
    { "t": "carry",  "cell": "carry.c3",  "value": "1", "anim": "pop" },
    { "t": "strike", "cell": "op1.c2" },                 // 받아내림 취소선
    { "t": "reveal", "cells": ["answer.c1"], "value": "6" }
  ]
}
```

- `cell` 주소 = `행id.열id` — 렌더러의 CSS Grid 좌표와 1:1 대응.
- `expect: true`인 `write` 스텝은 "학생 입력 대기" 지점(연습 모드), 없으면 시연 모드에서 자동 재생.
- `narration`은 aria-live 낭독 + 말풍선 겸용.
- 곱셈 부분곱은 `rows`에 `partial-1`, `partial-2` 행 추가, 나눗셈은 `bracket: {divisorCols, dividendCols}` 메타 + `rows`에 몫/곱/차 행을 반복 추가하는 식으로 확장.

**권장: A를 저장 포맷, B를 런타임/특수문제 포맷으로 이원화.** (A → B 파생 함수가 곧 채점기이기도 하다: 학생 입력을 expect 스텝과 대조.)

---

## 5. 권장 스택 (최종)

| 레이어 | 1순위 (권장) | 폴백/보조 |
|---|---|---|
| 세로셈 렌더링 | **커스텀 CSS Grid 컴포넌트** (자릿수=셀, `tabular-nums`, carry 행/부분곱 행, SVG 브래킷·사선) | 인쇄·공유용 정적 이미지가 필요하면 동일 데이터로 SVG 내보내기. MathML `elem-math` 폴리필은 관망만 |
| 인라인 수식(러닝 토탈 등) | 일반 HTML 텍스트(`623 + 100 = 723` 수준이면 충분) | 복잡해지면 KaTeX 부분 도입 |
| 입력 | **커스텀 digit-cell 에디터 + 가상 넘패드** (활성 셀 강조, auto-advance 방향 = method 필드, 셀 단위 초록/빨강 피드백) | 물리 키보드 숫자키·화살표 병행. 손글씨는 v2에서 온디바이스 숫자 인식(TF.js MNIST급)으로 검토 — MyScript/Mathpix는 키 노출·비용으로 제외 |
| 애니메이션 | **CSS transitions** + `prefers-reduced-motion` | 시퀀싱 필요 시 Motion mini `animate()`(~5KB). GSAP은 무료지만 과잉 |
| 데이터 | **시맨틱 JSON(후보 A) + 스텝 파생 엔진**, 나눗셈·특수 연출은 셀 좌표 스키마(후보 B) | — |
| 접근성 | 셀별 `aria-label`, DOM 순서=풀이 순서, `aria-live` 낭독, 레이아웃 사전 안내 | — |
| 배포 | 전부 클라이언트 사이드·외부 API 0개 → GitHub Pages 완전 호환 | — |

근거 요약: (1) 표준·라이브러리 어느 쪽도 세로셈을 셀 단위로 제어할 수 없고, (2) 어린이 UX의 핵심(다음 칸 안내, 즉시 피드백, 큰 터치 넘패드, 단계 애니메이션)은 전부 셀 단위 DOM 제어를 요구하며, (3) 검증된 상용 사례가 모두 같은 결론(per-cell grid)에 도달했고, (4) 정적 무료 호스팅에서는 외부 인식 API가 라이선스·키 관리상 불가능하기 때문.

미확인 사항(명시): MyScript 무료 쿼터의 정확한 수치, MathLive 최신 번들 정확 크기, 국내 앱(토도수학·매쓰플랫·콴다)의 세로셈 전용 UI는 공개 자료가 없어 직접 설치 확인이 필요함.

---

## 출처

- MathML Core 스펙: https://w3c.github.io/mathml-core/ / MathML 4 Full: https://www.w3.org/TR/mathml4/
- Igalia MathML in Browsers: https://mathml.igalia.com/project/ / caniuse MathML: https://caniuse.com/mathml
- W3C MathML polyfills (elem-math): https://github.com/w3c/mathml-polyfills
- MathJax v4 MathML 지원(mml3 experimental): https://docs.mathjax.org/en/v4.0/input/mathml.html
- MathJax longdiv 확장(v2): https://github.com/pkra/mathjax-extension-longdiv
- KaTeX long division 이슈: https://github.com/KaTeX/KaTeX/issues/1319 / 지원 표: https://katex.org/docs/support_table.html
- xlop 패키지: https://ctan.org/pkg/xlop
- MathLive: https://github.com/arnog/mathlive / fill-in-the-blank·환경 이슈: https://github.com/arnog/mathlive/issues/2156
- Math Mammoth long division practice: https://www.mathmammoth.com/practice/long-division
- The Great Martini Co. long division: http://www.thegreatmartinicompany.com/longarithmetic/longdivision.html
- free-training-tutorial: https://free-training-tutorial.com/long-division-games.html / Transum: https://www.transum.org/Maths/Exercise/Column_Method/Division_Long.asp
- 숫자 정렬 CSS: https://cssence.com/2024/text-align-decimal/ / MDN grid-column: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/grid-column
- MDN Grid 접근성: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Accessibility
- MathML a11y Gap Analysis: https://w3c.github.io/mathml-docs/gap-analysis/ / MathJax a11y: https://docs.mathjax.org/en/latest/basic/accessibility.html
- Learnosity math a11y: https://help.learnosity.com/hc/en-us/articles/360000758037-Accessibility-for-Math-Content
- Perkins School 그리드 활동: https://www.perkins.org/resource/digital-transitions-2-math-grid-activities/
- MyScript iinkTS: https://github.com/MyScript/iinkTS / 교육 라이선스: https://www.myscript.com/education/
- Mathpix API 가격: https://mathpix.com/pricing/api
- GSAP 무료화(2025.4): https://webflow.com/blog/gsap-becomes-free / 라이선스: https://gsap.com/community/standard-license/
- Motion 번들 축소 문서: https://motion.dev/docs/react-reduce-bundle-size
- Khan Academy Perseus(문항 렌더러, MIT — 세로셈 전용 위젯은 없음): https://github.com/Khan/perseus
- Arthur Benjamin 좌→우 계산법: https://plus.thegreatcourses.com/the-secrets-of-mental-math
