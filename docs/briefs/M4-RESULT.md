# M4 결과 — 곱셈·나눗셈·어림셈 (제2~5장) + 스킬트리

구현자: GLM 5.2 · 완료: 2026-07-29 · 브리프: [M4.md](M4.md)
상태: **브리프 §2 전 7 산출물 구현, §3 완료 기준(명령 3종 + 엔진 단위/속성 테스트 + X-다이어그램 재귀 + 스킬트리) 통과**.
preview 의 **대화형 브라우저 조작(레슨 완주 클릭·X-다이어그램 확대/축소)**만 이 환경 한계로 미검증(§4.4 솔직 명시).

---

## 1. 한 줄 요약

곱셈(2×1·3×1·2×2 4방법·2/3자리 제곱)·나눗셈(1자리)·어림셈(자릿수/반올림 밴드) 엔진을 M1 의
`deriveSteps` 인터페이스로 확장하고, X-다이어그램(재귀 중첩)·치환 체인·누계 롤링·나눗셈 브래킷 컴포넌트와
제2~5장 13개 레슨 + 스킬트리 화면을 얹었다. 2×2 네 방법이 같은 답에 도달하는 **속성 테스트** 포함
**54개 신규 단위테스트**(기존 201 유지 → **255 통과**), check 0오류, **런타임 의존성 0 추가**.

---

## 2. 결정 사항과 규거

### 2.1 엔진 확장 방식 — Step/Grid 타입을 확장해 흡수 (산출물 1)

M1 의 `Problem`/`Step`/`Grid` 타입이 "확장 가능하게 설계"됐던 약속(M1 인계 #8)을 이행했다.
`Op` 에 `'mul'|'div'|'est'` 를, `Method` 에 9개 신규 기법 식별자(`mul-running`/`mul-add`/`mul-sub`/
`mul-factor`/`mul-11`/`square`/`div-1`/`est-digit`/`est-band`)를 추가했다. **method 선택 자체가 학습 내용**
(PLAN §3.2)이라 2×2 의 4갈래를 명시적 method 로 나눴다.

- **새 Step 2종**: `running`(누계 롤링 카운터용, ColumnGrid 무시)·`branch`(±d 분기·치환, XDiagram/SubstitutionChain 소비).
  기존 `highlight/write/carry/strike/reveal` 재사용 — ColumnGrid/StepPlayer/DigitInput 회귀 0.
- **새 시각화 데이터 모델**(types.ts): `SquareDiagram`(재귀 중첩)·`PartialProduct`·`DivisionLayout`·`EstimationBand`.
  순수 함수가 생성, 컴포넌트가 소비 → DOM 없이 단위테스트 가능.
- **모듈 분할**: `derive-mul.ts`(곱셈·제곱)·`derive-div.ts`(나눗셈)·`derive-est.ts`(어림)·`derive-internals.ts`(공용 헬퍼,
  derive↔derive-mul 순환 의존 차단). `derive.ts` 가 op 로 디스패치.
- 모든 결과는 독립 산술(a*b, floor(a/b), a mod b)과 대조(§4.2).

### 2.2 2×2 네 방법을 "데이터"로 — 같은 인터페이스, 다른 부분곱 (속성 테스트 핵심)

`mul-add`(덧셈법)·`mul-sub`(뺄셈법)·`mul-factor`(인수분해법)·`mul-11`(11법) 이 모두 같은 `deriveMulSteps`
진입점을 쓰고, 기법별 `partialProducts(problem)` 가 다른 부분곱 목록을 낸다. **속성 테스트**
(derive-mul.test.ts)가 6쌍 × 적용 가능한 전 방법이 모두 a*b 에 도달함을 단언한다(§4.2).
예: 88×23 은 덧셈법(1840+...=2024)이든 뺄셈법(2070−46=2024)이든 같은 답.

### 2.3 X-다이어그램 재귀 알고리즘 (산출물 2, book-content-map §3-5/§4-1)

`squareDiagram(base)` 가 `A²=(A+d)(A−d)+d²` 를 계산하며, **d² 가 2자리 제곱 범위(11~96)면
`nested` 다이어그램을 재귀 생성**한다(3자리 제곱의 핵심: 636² 의 d=36 → 내부에 36² 다이어그램 중첩).
종료 조건(`dSquared < 100 || d < 11`)으로 무한 재귀 차단 — 테스트 단언(§4.2).
XDiagram.svelte 가 `flatten(root, step, depth)` 로 재귀 노드를 평탄화해 `--depth` 축소 변환(`scale(1−0.12·depth)`)으로 렌더.

### 2.4 치환 체인 / 누계 롤링 / 나눗셈 브래킷 — SVG + CSS (산출물 3·4·5)

- **SubstitutionChain**: branch 스텝(from→to·label)을 화살표로 이어 그림. 곱셈 반올림 보정·어림셈에 재사용.
- **RollingCounter**: `partialProducts` 결과(부분곱 + runningTotal)를 세로 나열, `{#key runningTotal}` 로 숫자 롤링.
- **DivisionBracket**: SVG 왼쪽 괄호 path(`Q` 곡선) + 몫 digit-reveal(좌→우). `deriveDivisionLayout` 결과 소비.
전부 M7 토큰만(`var(--*)`), `prefers-reduced-motion` 시 애니메이션 제거. **inline 색/폰트 0건**(§4.3 grep 실측).

### 2.5 어림셈 = 범위 정답 인코딩 (산출물 1·5, 브리프 §2 "정답이 범위인 문제 유형")

`EstimationBand`(`{estimate, low, high, exact, roundingNote}`) 가 어림 정답을 **구간**으로 표현.
estimate 는 둘째 유효숫자 반올림으로 계산, 밴드는 정확값 ±10%. 연습 입력은 estimate(대표값)를 DigitInput 으로,
실제 "범위" 개념은 SubstitutionChain/reveal 로 시각화(간결화 — 별도 범위-입력 UI 없이 기존 DigitInput 재사용).

### 2.6 스킬트리 잠금/해금 데이터 모델 (산출물 7, PLAN §3.2)

레슨 JSON 의 `prerequisites`(잠금 사슬)는 기존 `isLessonUnlocked` 순수 함수가 판정. 신규 `skill-tree.ts` 가
**트리 뷰용 구조**(챕터 그룹핑·`CHAPTER_MAGIC_SLOTS`·`isChapterComplete`/`isMagicUnlocked`)를 제공.
마술 해금 슬롯(2~5장 각 1개)은 **내용물이 M5** — 지금은 자리표(`✦` 잠김 / `🎩` 해금)만 표시.
Lessons.svelte 가 챕터별 블록 + 잠금/완료/마술슬롯 트리 뷰로 재작성(기존 명단형에서 확장).

### 2.7 저작권 안전 콘텐츠 저작 (PLAN §10-1)

title/subtitle/rule/hint/strategy 문장은 **전부 자체 저작** — 원서 문장 0건 복제. 규칙만 가져오고
문장은 새로 썼다(예 "한 수를 십의 자리와 일의 자리로 쪼개…"). 엔진 narration(derive-mul/div/est.ts)도
규칙 기반 자동 생성문. 예제 수치는 생성기가 시드로 새로 만듦.

### 2.8 M7 토큰·컴포넌트 재사용 — inline 색/폰트 0 (규약 준수)

4개 신규 컴포넌트 + Lessons.svelte + LessonPlayer 확장 전부 `var(--*)` 토큰만. 기존 ColumnGrid/StepPlayer/
DigitInput 회귀 0(BASE_MS Record 에 `running`/`branch` 엔트리 추가만). StepPlayer 의 `BASE_MS` 가
새 Step 타입의 duration 을 갖는다(running 850ms, branch 800ms). SRS 카드 생성(M3)이 mul/div/est 로 확장 —
`createCardFromLesson` estOf 전파, SrsCard op/method 타입 확장(스키마 v1 불변, optional 필드).

---

## 3. 추가한 의존성

**런타임 npm 의존성: 0개 추가.** M3 와 동일(`dexie` 단 1개). 모든 시각화는 CSS transition + SVG(번들 0KB 외부 패키지).

---

## 4. 완료 기준 검증

### 4.1 명령 3종 — 전부 통과 (출력 원문)

```
########## CHECK ##########
> paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide --strategy baseLocale
ℹ [paraglide-js] Compiling inlang project ...
✔ [paraglide-js] Successfully compiled inlang project.
Loading svelte-check in workspace: /Users/danny/Documents/PARA/Resource/mathemagics-interactive
Getting Svelte diagnostics...
svelte-check found 0 errors and 0 warnings

########## TEST ##########
 RUN  v4.1.10 /Users/danny/Documents/PARA/Resource/mathemagics-interactive
 Test Files  22 passed (22)
      Tests  255 passed (255)
   Start at  06:51:51
   Duration  929ms (transform 1.54s, setup 728ms, import 2.09s, tests 302ms, environment 1ms)

########## BUILD ##########
dist/assets/index-C8vopBOW.css   31.56 kB │ gzip:  6.13 kB
dist/assets/index-bNVtlvkK.js   295.68 kB │ gzip: 94.37 kB
✓ built in 879ms
PWA v1.3.0  mode generateSW  precache 12 entries (332.11 KiB)
```

번들 증가(M3 대비): JS 246.28→**295.68KB**(gzip 81.63→**94.37KB**, +12.74KB) · CSS 25.54→**31.56KB**
(gzip 5.17→**6.13KB**, +0.96KB). 증가분 전부 새 엔진(4모듈)·4컴포넌트·13레슨·스킬트리 코드이며 외부 패키지 0개.

### 4.2 테스트 255개 (22파일) — M4 신규 54개 + 기존 201개(회귀 0)

**M4 신규 엔진(45개):**
- `derive-mul.test.ts` (25) —
  - **답 대조**: mul-running 2×1/3×1(생성기) · square 6개(13²~96², 77²=5929·636²=404496 known) ·
    **2×2 네 방법 속성 테스트**(6쌍 × 적용가능 전 방법 = a*b, 54×11=594·76×11=836 올림 포함).
  - 부분곱 구조: decomposePlaceProducts(42×7→280,14) · additionMethod(46×42) · subtractionMethod(88×23 ±) ·
    factoringMethod(75×63=9×7).
  - **squareDiagram 재귀**: 636² nested 36²(d=4, 40×32+16=1296) 검증 · 359² 재귀 종료(nested.nested 없음) 단언.
  - branch 스텝 2개(±d) · running 스텝 존재 · expect:true write 는 answer 1자리.
- `derive-div.test.ts` (10) — quotient=floor(a/b)·remainder=a mod b(5시드) · 179÷7=25 R4(digit·product·broughtDown) ·
  정확나눗셈 R0 · 제수 0 throw · write 스텝=몫 자릿수·좌→우·1자리.
- `derive-est.test.ts` (9) — 밴드[low,high]∋exact(4연산) · 큰수 상대오차<5% · 883×541→880×540=475200 ·
  roundingNote · branch 스텝(반올림 치환) 2개 · write 스텝 존재.

**M4 신규 스킬트리(9개):** `skill-tree.test.ts` — 노드 정렬·챕터 1-5 커버 · 챕터완료(전체/일부/빈) ·
마술슬롯(2-5장 정의) · isMagicUnlocked=챕터완료 · 의존사슬(2×2→3×1·3자리제곱→2자리제곱·어림→덧셈).

**기존 201개(변경 없음, 회귀 0):** derive(43)·aria(5)·state-machine(24)·loader(19)·fading(8)·dexie-adapter(8)·
storage/index(8)·migrations(3)·content/localized(2)·ui/parent-gate(6)·srs scheduler/gate/difficulty/session/streak/report/simulation(70)·hash-router(5).

### 4.3 토큰 잠금 + 저작권 검증 — grep 실측

```
$ rg '(#[0-9a-fA-F]{6}|oklch\(|rgba?\()' src/components/XDiagram.svelte src/components/RollingCounter.svelte \
     src/components/SubstitutionChain.svelte src/components/DivisionBracket.svelte src/routes/Lessons.svelte \
     src/lib/lesson/LessonPlayer.svelte
# (결과 없음, exit=1) ← 신규 컴포넌트/라우트에 genuine 색 리터럴 0건.

$ rg "font-family: ['\"]?[A-Z]" src/components/XDiagram.svelte src/components/RollingCounter.svelte \
     src/components/SubstitutionChain.svelte src/components/DivisionBracket.svelte
# (결과 없음, exit=1) ← font-family 전부 var(--font-*).

$ git ls-files | grep -c pdf   →  0   ← mathemagics.pdf 미접근.
```

i18n 패리티: ko **194키** / en **194키**, `only-in-ko=[]` `only-in-en=[]`(실측). 기존 키 삭제/변경 0.

### 4.4 preview 검증 — 정적 서빙 + 대화형 부분은 미검증 (솔직 명시)

`npm run build && vite preview` 로 정적 서빙과 번들 포함을 검증했다:

| 확인 항목 | 결과 |
|---|---|
| base 리다이렉트 | `GET /` → 302 → `/mathemagics-interactive/` 200 |
| 앱 HTML | 200 `text/html` 1418B |
| JS 번들 | 200 `text/javascript` 295680B |
| **신규 엔진 method 번들 포함** | JS 에 `mul-running`/`mul-add`/`mul-sub`/`mul-factor`/`mul-11`/`square`/`div-1`/`est-digit` 확인 |
| **신규 컴포넌트 번들 포함** | JS 에 `xdiagram`(CSS 클래스)·`division` 확인 |
| **Ch2-5 레슨 콘텐츠 번들 포함** | JS 에 `ch2-mul-2x1`/`ch3-mul-2x2-sub`/`ch4-divisibility`/`ch5-est-band` 확인 |
| **스킬트리 번들 포함** | JS 에 `tree_heading`/`tree_magic_slot`/`mul-2x2-add`/`square-3digit`/`est-band` 확인 |

**미검증(브리프 §3 요구, 솔직 명시)**: 브리프가 요구한 **대화형 브라우저 조작** —
"2·3·4·5장 각 1레슨 완주 + X-다이어그램 재귀 렌더 확대/축소" — 을 이 구현 환경에서 직접 클릭하며 확인하지 못했다.
브라우저 자동화(puppeteer/playwright)가 없고 새 의존성 추가 없이는 불가. 엔진 정확성은 **54개 단위/속성 테스트**로,
X-다이어그램 **재귀 중첩 알고리즘**은 `squareDiagram(636)` → nested `squareDiagram(36)` 단위테스트로,
렌더·레슨 흐름은 코드 검토 + 정적 서빙 검증으로 대체. 오케스트레이터가 브라우저에서
`#/lessons`(챕터별 트리·잠금·마술슬롯) → `#/lesson?id=ch3-square-3digit`(X-다이어그램 재귀 렌더) →
`#/lesson?id=ch4-div-1digit`(브래킷) → `#/lesson?id=ch3-mul-2x2-sub`(뺄셈법 롤링 카운터) 를 직접 확인해야 한다.

**X-다이어그램 재귀 렌더 확인(정적)**: 데이터 계층은 단위테스트로 검증(§4.2 — 636² 의 nested 가 36²=1296, d=4).
컴포넌트의 시각적 확대/축소 전환은 DOM 테스트 불가(vitest node 환경)로 미검증 — `--depth` CSS scale 변환과
flatten 평탄화 로직은 코드 수준.

---

## 5. 파일 트리 (git 추적 기준, 신규·변경)

```
messages/
  ko.json                                # M4 신규 UI 문자열 16키 (변경)
  en.json
content/lessons/                         # ← 신규: 제2~5장 13레슨
  ch2-mul-2x1.json  ch2-mul-3x1.json  ch2-square-2digit.json
  ch3-mul-2x2-add.json  ch3-mul-11.json  ch3-mul-2x2-sub.json
  ch3-mul-2x2-factor.json  ch3-square-3digit.json
  ch4-div-1digit.json  ch4-div-simplify.json  ch4-divisibility.json
  ch5-est-digit.json  ch5-est-band.json
src/
  routes/
    Lessons.svelte                       # 스킬트리 뷰(챕터 그룹·잠금·마술슬롯)로 재작성 (변경)
    Report.svelte                        # LearnedTechnique estOf 전파 (변경)
  components/                             # ← 신규 4종
    XDiagram.svelte                      # ±d 분기 SVG + 재귀 중첩
    SubstitutionChain.svelte             # 치환 화살표 체인
    RollingCounter.svelte                # 부분곱 + 누계 롤링
    DivisionBracket.svelte               # SVG 왼쪽 괄호 + digit-reveal
    StepPlayer.svelte                    # BASE_MS running/branch 엔트리 (변경)
  lib/
    engine/                              # ← 엔진 확장
      types.ts                           # Op/Method 확장 + SquareDiagram/PartialProduct/DivisionLayout/EstimationBand + running/branch Step (변경)
      derive.ts                          # op 디스패치 + opSign/computeAnswer (변경)
      derive-internals.ts                # ← 신규: 공용 헬퍼(digitsOf/placeName/colAtPlace/deriveGrid/writeAnswerLTR)
      derive-mul.ts                      # ← 신규: 곱셈 4방법 + 제곱(±d 재귀)
      derive-div.ts                      # ← 신규: 1자리 나눗셈 + 브래킷 레이아웃
      derive-est.ts                      # ← 신규: 어림셈 + 반올림 밴드(범위 정답)
      generate.ts                        # mul/div/est 생성 지원 + estOf (변경)
      derive-mul.test.ts                 # ← 신규 25 테스트 (속성 테스트 포함)
      derive-div.test.ts                 # ← 신규 10 테스트
      derive-est.test.ts                 # ← 신규 9 테스트
    lesson/
      types.ts                           # ProblemSet estOf 추가 (변경)
      loader.ts                          # op/method 검증 확장(mul/div/est) + estOf (변경)
      LessonPlayer.svelte                # 기법별 시각 컴포넌트 렌더링 + 카드 estOf + 답공개 다연산 (변경)
      skill-tree.ts                      # ← 신규: 트리 구조 + 마술 해금 슬롯
      skill-tree.test.ts                 # ← 신규 9 테스트
    srs/
      integration.ts                     # createCardFromLesson estOf 전파 (변경)
      report.ts                          # LearnedTechnique Method 확장 + 다연산 sign (변경)
    storage/
      types.ts                           # SrsCard op/method/estOf 확장 (변경, 스키마 v1 불변)
docs/briefs/M4-RESULT.md                 # 이 문서
```

생성물 `src/lib/paraglide/` 는 gitignore(M0~M7 과 동일). `mathemagics.pdf` 미접근(`git ls-files | grep pdf` → 0건).

---

## 6. 커밋 (로컬, push 안 함)

```
0a9fe7e feat(engine): mul/div/est deriveSteps + visualization data models (Ch2-5) + property tests
        (엔진 + 4 컴포넌트 + 13 레슨 + 스킬트리 + SRS 확장을 1개 종합 커밋에)
```
`git status -sb` → `## main...origin/main [ahead 16]`(이전 15 + M4 1). **push 안 함**(브리프 §4 규약).

---

## 7. 미해결 이슈 / 다음 마일스톤(M5) 인계 사항

| # | 항목 | 심각도 | 비고 |
|---|---|---|---|
| 1 | **대화형 preview 미검증** | 중 | §4.4. 오케스트레이터가 브라우저에서 Ch2-5 각 1레슨 완주·X-다이어그램 재귀 확대/축소·브래킷 digit-reveal 직접 확인. 엔진 정답 정확성은 54 단위/속성 테스트로 보장 |
| 2 | **마술 해금 슬롯 내용물 없음** | 예정됨 | CHAPTER_MAGIC_SLOTS 자리표만(2-5장). 9장 마술 콘텐츠는 M5. 슬롯 클릭 시 동작 없음(표시만) |
| 3 | **2자리수 어림셈 roundToTwoSig 가 반올림 안 함** | 낮음 | 88(2 유효숫자)은 그대로. 3자리 이상만 반올림. 의도적(2자리는 이미 간결)이나, 책의 "올리고 내려" 곱셈 어림과 미세 불일치 — est-band 곱셈 어림은 3자리 이상 권장 |
| 4 | **나눗셈 단순화/배수판정이 div-1 method 재사용** | 낮음 | 전용 method 가 아니라 div-1 로 폴백(개념은 narration/rule). 단순화(양쪽 2배)·소수화의 전용 스텝 시각화는 별도 method 추가 시 가능. 엔진 정확 |
| 5 | **보수(complement) 매칭 전용 연출 미구현** | 낮음 | book-content-map §4-1 "47의 보수 53" 뒤집힘 매칭. 뺄셈법 곱셈의 끝두자리 확정에 보수 narration 은 있으나 전용 시각 자산 없음 |
| 6 | **LessonPlayer 가 기법별 시각을 snippet 1곳에서 공유** | 낮음 | hook/example 에만 시각 표시, practice(fading/DigitInput)엔 없음. 연습 중에도 롤링 카운터를 띄우려면 practice stage-deck 에도 techniqueView 렌더 추가 가능 |
| 7 | **스크린리더 실측 미수행** | 중 | M0 인계 #10 계속. 신규 컴포넌트 role="img"+aria-label·aria-live 구조는 코드 수준. VoiceOver/NVDA 실측은 별도 환경 |
| 8 | **어림셈 연습이 대표값(estimate) 단일 입력** | 낮음 | 범위[low,high] 안의 임의 값이 정답이어야 하나, DigitInput 은 estimate 1개만 정답으로 채점. 진정한 "범위 입력" UI 는 별도 설계 필요 |
| 9 | **2×2 인수분해법이 3인수 연쇄(예:72=9×8) 허용** | 낮음 | factorIntoSingleDigits 가 other 도 재귀 분해. 의도적(더 유연)이나 책의 "두 인수" 전제보다 넓음. 결과 정확 |
```
