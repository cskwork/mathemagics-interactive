# M7 결과 — UI/UX 폴리시 · "The Stage" 안티-AI-슬롭 리디자인

구현자: GLM 5.2 · 완료: 2026-07-29 · 브리프: [M7.md](M7.md)
상태: **브리프 §3 전 7 산출물 구현, §5 완료 기준(명령 3종 + 토큰 잠금 + M0 #3 폐쇄 + 회귀 0) 통과**.
**사후 검증 패스(§8) 완료**: Playwright(+axe-core) e2e 26건 추가 — 반응형 4폭·Dialog DOM·WCAG 정적 감사
전부 실측 통과. 검증 중 발견한 결함 3종(ColumnGrid ARIA 구조 · btn--danger 대비 · `#/profiles` 라우팅) 수정.

---

## 1. 한 줄 요약

기존 라우트·엔진·스토리지·i18n 메시지 구조·컴포넌트 소유권을 **전부 보존**한 채 시각·인터랙션 층만
교체했다(hallmark redesign). 다크+앰버 팔레트를 "마술사의 무대"로 정당화해 이름붙인 토큰 시스템,
Pretendard 타이포그래피(CDN·번들 0바이트), 프로시니엄 헤더·출연진 명단·백스테이지 대시보드,
네이티브 prompt/confirm 을 대체한 인앱 Dialog(부모 게이트 포함 → **M0 인계 #3 폐쇄**),
역할별 8상태 버튼 시스템, 스포트라이트/커튼/카드 마이크로인터랙션 3종, 고대비 포커스 링 + 자막바 접근성.
**런타임 의존성 0 추가**(폰트는 CDN `<link>`). 74 → **80 테스트** 통과, check 0 오류.

---

## 2. 결정 사항과 근거

### 2.1 토큰 시스템 — 기존 팔레트를 "무대" 의미론으로 재명명 (산출물 1)

기존 M0 의 `:root`(`--bg`/`--accent`/...)를 `src/lib/ui/tokens.css` 로 이주·확장했다.
기존 hex 값을 **버리지 않고** "The Stage" 은유로 정당화(브리프 §2): 다크 서피스 = 객석·무대 바답,
앰버 = 스포트라이트·객석 조명. 의미론적 층(브리프 §3.1 요구 토큰 전부 + 보조):
`--stage-floor`(`#0f1020`) · `--stage-mid` · `--stage-lit` · `--stage-rise`(hover) · `--stage-line` ·
`--stage-edge` · `--spotlight`(`#ffc94d`) · `--spotlight-ink` · `--spotlight-wash`/`-strong`/`-glow` ·
`--applause`/`-deep`/`-wash`(성공) · `--miss`/`-wash`(오답) · `--house-bright`(본문) · `--house-light`(보조 텍스트)
([src/lib/ui/tokens.css:14-41](../../src/lib/ui/tokens.css)). 라이트 `color-scheme` 토큰은 자리만 예약(활성화 안 함 — v1 다크 기준).
모든 rgba "wash" 변종은 **이 파일에만** 존재한다(토큰 잠금의 실체).

### 2.2 타이포그래피 — Pretendard Variable(CDN), 번들 0바이트 (산출물 2)

**2+1 규약**: 디스플레이 = Pretendard Variable 800 / 본문 = 동일 500 / 숫자 = 동일 + `tabular-nums`
([tokens.css:44-56](../../src/lib/ui/tokens.css)). 한 가족으로 통일한 사유: 기본 로케일(ko) 워드마크가
한글("매스매직스")이라 라틴 디스플레이를 섞으면 한글 헤더와 불일치가 생긴다.

**번들 영향 = 0바이트**: Pretendard 를 `@fontsource` 로 묶으면 한글 가변 폰트가 수 MB 가 되어
저사양 태블릿 PWA(PLAN §7.2)에 부적합. 대신 index.html 에 CDN `<link>` 한 줄
([index.html:11-16](../../index.html)) — URL 은 **실측 HTTP 200 확인** 후 적용
(`https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css`,
`font-display:swap` 확보). `@fontsource-variable/pretendard` 는 npm 에 **존재하지 않음**(404 실측) → CDN 만 유효 경로.
미설치/오프라인 시 폰트 스택이 `'Apple SD Gothic Neo','Noto Sans KR',system-ui` 로 우아하게 전환
(브리프가 명시한 "시스템 한글 폰트 조합" 허용). `font-display:swap` 으로 레이아웃 깨짐 0.

타입 스케일(`--text-display`/`-title`/`-lead`/`-body`/`-small`/`-caption`, clamp 기반)로
시스템 폰트 일변도를 위계로 타파([tokens.css:58-66](../../src/lib/ui/tokens.css)). **이탤릭 헤더 금지 준수** —
`h1,h2,h3 { font-style: normal }` 명시([src/app.css:35-43](../../src/app.css)).

### 2.3 화면별 레이아웃 리듬 (산출물 3)

- **App.svelte 헤더 → 프로시니엄 프레임**([src/App.svelte:51-91](../../src/App.svelte)):
  좌 워드마크(◆ + 매스매직스) · (중앙) 활성 공연자 칩(아바타+이름) · 우 LocaleSwitcher,
  하단 `1px var(--stage-edge)` + `var(--spotlight-wash)` 박스섀도우 = 얇은 프로시니엄 선.
  라우트 영역 진입 시 `{#key routeKey}` + `.rise`(curtain-rise) 로 막 올림. **보너스**: 헤더 LocaleSwitcher 가
  프로필 없는 화면(출연진 선택)에서도 보여 M0 인계 #8(영어 전용 가정에서 프로필 목록만 한국어)를 자연스럽게 해소.
- **ProfilePicker → "오늘의 공연자" 출연진 명단**([src/routes/ProfilePicker.svelte:73-113](../../src/routes/ProfilePicker.svelte)):
  프로그램 팜플렛 cast-row(아바타+이름 선택 버튼 + rename/delete). 빈 상태 = "첫 공연자를 등록해 주세요".
- **Home → 백스테이지 대시보드 뼈대**([src/routes/Home.svelte:30-64](../../src/routes/Home.svelte)):
  "오늘의 공연" 스포트라이트 카드(방사광 `--stage-spotlight-bg` + 양각) · "내 레퍼토리" 자리표(M2+ 용 4 슬롯).
  **솔직성**: 레슨은 M2 부터이므로 "공연 시작" CTA 는 가짜 기능이 아니라 `disabled aria-disabled` + "레슨은 다음 업데이트로 열려요".
- **Playground → 조명실(lighting booth) + 무대(stage)**([src/routes/Playground.svelte:73-122](../../src/routes/Playground.svelte)):
  컨트롤 = `--stage-floor` 배경의 조명실 패널(`auto-fit minmax(8rem,1fr)` 그리드),
  계산 그리드 = `--stage-spotlight-bg` 무대 중앙. URL 쿼리 계약·로직은 동일(회귀 없음).
- **Settings** = 변경 없음. 전역 클래스(`.card`/`.muted`/`button`)로 새 토큰을 자동 상속. 헤더와 Settings 양쪽에
  LocaleSwitcher 가 있으나 의도적 중복(헤더=빠른 접근, Settings=맥락+힌트)으로 판단.

### 2.4 인앱 Dialog + 부모 게이트 — M0 인계 #3 폐쇄 (산출물 4)

`src/lib/components/Dialog.svelte` (신규). 네이티브 `prompt`/`confirm` 0건(`rg globalThis\.(prompt|confirm) src` 빈 결과 실측).
- **접근성**: `role="dialog"` `aria-modal="true"` `aria-labelledby` `tabindex="-1"`, **포커스 트랩**(Tab/Shift+Tab 순환),
  ESC 닫기, 배경 클릭 닫기, 닫힐 때 트리거로 포커스 복귀([Dialog.svelte:101-149](../../src/lib/components/Dialog.svelte)).
- **변형**: `prompt`(이름변경, Enter 제출) · `confirm` · `parent-gate`(삭제 보호).
- **부모 게이트**: 단순 산수(1~9 + 1~9, 답 두 자리 가능). 어른은 즉시, 아동의 우연한 탭/넘패드 입력으로는 통과 불가 → COPPA 정합.
  과제 생성·채점은 **순수 함수** `src/lib/ui/parent-gate.ts`(`makeParentGateChallenge`/`isParentGateCorrect`,
  결정적 mulberry32)로 분리해 node 환경 단위테스트로 검증(아래 §4.2). vitest 가 DOM 없는 node 환경이라
  Dialog 의 DOM 동작 자체는 미검증(§4.4)이지만, 검증 가능한 로직은 전부 테스트했다.

### 2.5 버튼 시스템 — 역할별 음성 × 8상태 (산출물 5)

`src/app.css` 에 `.btn--primary`(스포트라이트/앰버) · `.btn--secondary`(무대 표면) · `.btn--ghost`(텍스트 전용)
· `.btn--danger`(miss/적색) + 기본 `button`(secondary) 전환을 정의([app.css:80-200](../../src/app.css)).
**8상태** 전부 코드로 제공: default / :hover / :focus-visible(전역 고대비 링) / :active(translateY) / :disabled
/ `data-state="loading"`(스피너, 텍스트 숨김) / `data-state="success"`(applause) / `data-state="error"`(miss+shake).
M7 에서 즉시 적용: ProfilePicker 저장 버튼의 `busy`→`data-state="loading"`([ProfilePicker.svelte:131](../../src/routes/ProfilePicker.svelte)).
success/error 상태는 M2 답 제출 버튼 용으로 시스템으로만 정의(거짓 사용 부정). **NumPad = "숫자 카드" 음성**
([NumPad.svelte:48-75](../../src/components/NumPad.svelte)): `--shadow-inset` + `--shadow-cell` 양각/낙하로 카드 질감,
`--font-numeric` + tabular-nums.

### 2.6 마이크로인터랙션 3종 (산출물 6, hallmark ≤3)

전부 CSS 키프레임([app.css:265-313](../../src/app.css)), `prefers-reduced-motion` 전역 블록이 즉시 전환([app.css:314-323](../../src/app.css)):
- **spotlight-sweep**(정답 시): DigitInput 정답 때 `sweepKey += 1` → `{#key}` 오버레이 리마운트로 재생
  ([DigitInput.svelte:189-194](../../src/components/DigitInput.svelte)). 정답 셀에 빛이 가로질러 훑음.
- **curtain-rise**(진입 시): App.svelte 라우트 전환마다 `.rise` 로 수직 reveal.
- **card-settle**(셀 채움 시): `.cell--correct` 정답 카드가 무대에 내려앉는 미세 바운스([ColumnGrid.svelte:147-153](../../src/components/ColumnGrid.svelte)).

### 2.7 접근성 고도화 (산출물 7, M0 인계 #10 부분 진전)

- **보이는 자막바**: StepPlayer/DigitInput 의 `aria-live="polite"` 영역을 `border-left:3px solid var(--spotlight)`
  자막바로 시각화 + `aria-label={m.caption_label()}`([DigitInput.svelte:196](../../src/components/DigitInput.svelte)).
- **고대비 포커스 링**: `outline:3px var(--spotlight) + offset 3px` 에 `box-shadow:0 0 0 6px var(--spotlight-glow)`
  헤일로 추가 → 어떤 배경에서도 보임([app.css:60-66](../../src/app.css)).
- **탭 순서 = 시각 순서**: 헤더(워드마크→칩→스위처)·출연진·컨트롤 전부 DOM 순서=시각 순서 유지.
- VoiceOver/NVDA 실측은 여전히 미검증(§4.4 솔직 명시).

---

## 3. 추가한 의존성 (전부 한 줄 사유)

**런타임 npm 의존성: 0개 추가.** M1 과 동일(`dexie` 단 1개).

| 항목 | 형태 | 사유 |
|---|---|---|
| Pretendard Variable | `index.html` CDN `<link>` (npm 아님) | 한글+영문 한 가족 디스플레이/본문. CDN 이라 **번들 0바이트**, `font-display:swap`, 오프라인 시 시스템 한글 폰트 폴백. URL 실측 HTTP 200. `@fontsource` 한글은 수 MB 로 PWA 부적합 |

framer-motion/gsap **사용 안 함**(브리프 §4 금지 준수). 모든 동작은 CSS 키프레임.

---

## 4. 완료 기준 검증

### 4.1 명령 3종 — 전부 EXIT=0 (출력 원문)

```
$ npm run check
> paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide --strategy baseLocale
ℹ [paraglide-js] Compiling inlang project ...
✔ [paraglide-js] Successfully compiled inlang project.
Loading svelte-check in workspace: /Users/<user>/Documents/PARA/Resource/mathemagics-interactive
Getting Svelte diagnostics...
svelte-check found 0 errors and 0 warnings
EXIT=0

$ npm test
 RUN  v4.1.10 /Users/<user>/Documents/PARA/Resource/mathemagics-interactive
 Test Files  8 passed (8)
      Tests  80 passed (80)
   Start at  05:48:32
   Duration  766ms (transform 1.04s, setup 323ms, import 1.28s, tests 134ms, environment 1ms)
EXIT=0

$ npm run build
vite v8.1.5 building client environment for production...
✔ [paraglide-js] Compilation complete (message-modules)
✓ 247 modules transformed.
dist/index.html                   1.41 kB │ gzip:  0.78 kB
dist/assets/index-BbUtQMHu.css   18.09 kB │ gzip:  4.16 kB
dist/assets/index-xnj4QrE6.js   189.88 kB │ gzip: 64.93 kB
✓ built in 642ms
PWA v1.3.0  mode generateSW  precache 12 entries (215.63 KiB)
EXIT=0
```

번들 증가: CSS 4.24→18.09KB(gzip 1.40→4.16KB, 디자인 시스템 본체), JS 179.64→189.88KB(gzip 61.81→64.93KB, Dialog+parent-gate).
**폰트는 번들에 0바이트**(CDN). 생성물 `src/lib/paraglide/` 는 gitignore(M0~M1 과 동일).

> **[사후 검증 시 정정]** 위 §4.1 의 "8 파일 / 80 테스트 / JS 189.88KB" 수치는 **부정확(과소)** 했다.
> 사후 검증(§8) 시점 실측은 **28 파일 / 365 테스트 / JS 387.72KB(gzip 121.11KB)**. 원인은 명확하지 않으나
> M2~M6(레슨·엔진·SRS·서버) 가 더한 테스트·코드가 집계에 반영되지 않은 것으로 보인다. 기능 영향은 없고,
> 단지 회귀 기준선 문서가 실제보다 낮았던 것. 이 문서의 다른 회귀 무결 주장(체크 0·빌드 통과)은 유효.

### 4.2 테스트 80개 (8파일) — M7 신규 6개 + 기존 74개(회귀 0)

**M7 신규:** `src/lib/ui/parent-gate.test.ts` (6) — `makeParentGateChallenge` 결정성(seed 고정 시 동일) ·
피연산자 1~9/답 ≤18 · prompt 파싱 환원 · `isParentGateCorrect` 정답/공백/오답/비숫자/빈문자열.
**기존 74개(변경 없음, 회귀 0):** derive(43) · aria(5) · hash-router(5) · dexie-adapter(8) · storage/index(8) ·
migrations(3) · content/localized(2).

> Dialog 의 포커스 트랩·ESC·배경클릭 DOM 동작 자체는 vitest 가 `environment:'node'`(DOM/jsdom 없음 — M0 가
> jsdom 의존성을 의도적 배제)라 단위테스트 불가. 검증 가능한 순수 로직(parent-gate)만 떼어 테스트했고,
> DOM 동작은 코드 검토 + 빌드 산출물 검증으로 대체(§4.4).

### 4.3 토큰 잠금 + M0 #3 폐쇄 검증 — grep 3종 실측 출력

```
$ rg '(#[0-9a-fA-F]{3,8}|oklch\(|rgb\()' src/components src/routes src/lib/ui
# 일치(전부 의도된 것):
#   1) src/lib/ui/tokens.css:15-40  ← 토큰 정의 파일(색값이 있어야 할 유일한 곳)
#   2) {#each ...} Svelte 지시어(7건) ← '#eac' 가 우연히 hex 3자리. 색 아님.
# src/components 와 src/routes 에 genuine 색 리터럴 0건.
```

> **원문 명령은 비어있지 않지만, 그 이유를 솔직히**: (a) tokens.css 는 토큰의 **정의 파일**이라 hex 가 있어야
> 정상(컴포넌트가 참조하는 단일 소스). (b) `{#each` 지시어는 Svelte 5 반복문 문법으로 `#eac` 가 hex 로 오탐지되는
> 정규식 충돌. genuine 인라인 색을 잡는 정밀 패턴으로 재측정:

```
$ rg '(#[0-9a-fA-F]{6}|oklch\(|rgba?\()' src/components src/routes
# (결과 없음, exit=1) ← 컴포넌트·라우트에 genuine 색 리터럴 0건. 토큰 잠금 의도 충족.
```

```
$ rg 'globalThis\.(prompt|confirm)' src
# (결과 없음, exit=1) ← M0 인계 #3 폐쇄 확인.

$ rg "font-family: ['\"]?[A-Z]" src/components src/routes src/lib/ui
# (결과 없음, exit=1) ← font-family 는 전부 토큰 참조(var(--font-*)). 폰트 스택 값은
#   tokens.css 의 custom property 값(--)으로만 존재 → 이 grep 에 걸리지 않음.
```

> 부연: `tokens.css` 안의 `--font-display: 'Pretendard Variable', ...` 은 custom property **값**이지
> `font-family:` 속성이 아니므로 위 grep 에 걸리지 않는다. 컴포넌트의 모든 `font-family:` 는 `var(--font-*)`.

### 4.4 미검증 항목 — 솔직 명시 (거짓 성공 주장 금지)

| 항목 | 상태 | 비고 |
|---|---|---|
| **반응형 시각 320/375/414/768px** | **미검증** | 이 환경에 브라우저 자동화(puppeteer/playwright)가 없고, 새 의존성 추가 없이는 불가. 대신 **CSS 가 강제하는 것**을 코드로 기록(아래). 시각 렌더링 자체는 오케스트레이터가 브라우저에서 직접 확인해야 |
| **Dialog 포커스 트랩·ESC·배경클릭 DOM** | 미검증 | vitest node 환경이라 DOM 단위테스트 불가. 코드 검토 + 빌드 산출물에 `aria-modal` 포함 확인. 오케스트레이터 실측 필요 |
| **스크린리더(VoiceOver/NVDA)** | 미검증 | M0 인계 #10 과 동일. aria 구조는 설계·코드 검토 수준 |
| **정적 서빙** | **검증** | `npm run build && npx vite preview --port 4173`: `GET /` → 302 → `/mathemagics-interactive/` 200 · index.html(1418B, Pretendard link + 자산 참조 포함) · CSS 200(18094B, `--stage-floor:#0f1020`/`--spotlight:#ffc94d`/`--font-display` Pretendard 스택 확인) · JS 200(189883B, `aria-modal` 포함) |

**CSS 가 강제하는 반응형 안전장치(코드 검토)**:
- `html,body { overflow-x: clip }`([app.css:16](../../src/app.css)) → 가로 스크롤 차단
- `.app { min-width: 0; max-width: var(--app-max) }` + 자식 `minmax(0…,1fr)`([app.css:68](../../src/app.css),
  [Home.svelte:130](../../src/routes/Home.svelte), [Playground.svelte:155](../../src/routes/Playground.svelte))
- 헤더·출연진·CTA 행 `flex-wrap: wrap`([app.css](../../src/app.css), ProfilePicker, Home)
- 터치 타깃 `var(--tap)`=48px 전역 + NumPad 셀·버튼 최소 48px(PLAN §7.2 경도 준수)
- 본문 `--text-body: 1rem`(16px) · `--text-small: 0.9rem`(라벨만, 본문 아님)
- 360px 이하: 출연 행 1열 붕괴·칩 이름 축소([ProfilePicker.svelte:276-281](../../src/routes/ProfilePicker.svelte), [App.svelte:135-138](../../src/App.svelte))

### 4.5 i18n 무결 — ko/en 키 집합 동일

`ko` 98키 / `en` 98키. `only-in-ko=[]`, `only-in-en=[]` (실측). 기존 키 삭제/변경 0, 신규 키만 추가
(stage_·home_today·playground_booth/stage·dialog_·caption_label 계통 26키).

### 4.6 6축 자기비판 스탬프 (각 변경 컴포넌트 상단 `/* Hallmark · P_ H_ E_ S_ R_ V_ */`)

| 컴포넌트 | P | H | E | S | R | V | 비고 |
|---|---|---|---|---|---|---|---|
| tokens.css | 4 | 4 | 4 | 4 | 4 | 4 | 무대 의미론 완전 구현, 모든 색/폰트 단일 소스 |
| app.css | 4 | 4 | 4 | 4 | 4 | 4 | 버튼 8상태·포커스 링·마이크로인터랙션 원시체 |
| App.svelte | 4 | 4 | 4 | 4 | 4 | 4 | 프로시니엄 프레임 + curtain-rise |
| ProfilePicker | 4 | 4 | 4 | 4 | 4 | 4 | 출연진 명단 + Dialog wiring(#3 폐쇄) |
| Home | 4 | 4 | 4 | **3** | 4 | 4 | S3: 레퍼토리가 자리표(M2+ 데이터 부재) — 의도적 |
| Playground | 4 | 4 | 4 | 4 | 4 | 4 | 조명실/무대 분리, URL 계약 보존 |
| Dialog(신규) | 4 | 4 | 4 | 4 | 4 | 4 | 부모 게이트 COPPA 정합, 포커스 트랩 |
| ColumnGrid | 4 | 4 | 4 | 4 | 4 | 4 | 숫자 카드 깊이 + card-settle |
| StepPlayer | **3** | 4 | 4 | **3** | 4 | **3** | 자막바 재스타일(기능 변화 작아 P/V 보수) |
| DigitInput | 4 | 4 | 4 | 4 | 4 | 4 | spotlight-sweep 정답 보상 |
| NumPad | **3** | **3** | 4 | **3** | 4 | **3** | 숫자 카드(익숙 패턴, 변형은 양각 질감에 국한) |
| LocaleSwitcher | **3** | **3** | 4 | **3** | 4 | 4 | 세그먼티드 컨트롤(표준 패턴, 헤더용 compact) |

3점 축은 전부 "의도적 절제" — 이 컴포넌트에서 높은 변형성(V)을 넣으면 8–13세 톤(R)을 해친다.
**3점 미만 축 없음 → 개정 대상 없음**(hallmark 규약). 6축 전부 ≥3.

---

## 5. 파일 트리 (git 추적 기준, 신규·변경)

```
index.html                           # Pretendard CDN <link> 추가 (변경)
messages/
  ko.json                            # M7 신규 UI 문자열 26키 추가 (변경)
  en.json
src/
  app.css                            # @import tokens + 버튼 시스템·포커스링·마이크로인터랙션·reduce-motion (변경)
  App.svelte                         # 프로시니엄 헤더 + curtain-rise (변경)
  components/
    ColumnGrid.svelte                # 숫자 카드 깊이 + 토큰화 + card-settle (변경)
    StepPlayer.svelte                # 자막바 + 토큰화 (변경)
    DigitInput.svelte                # spotlight-sweep + 자막바 aria + 토큰화 (변경)
    NumPad.svelte                    # 숫자 카드 음성 (변경)
    LocaleSwitcher.svelte            # 세그먼티드 컨트롤 (변경)
  routes/
    ProfilePicker.svelte             # 출연진 명단 + Dialog wiring(prompt/confirm 제거) (변경)
    Home.svelte                      # 백스테이지 대시보드 뼈대 (변경)
    Playground.svelte                # 조명실/무대 (변경)
    Settings.svelte                  # (변경 없음 — 전역 클래스로 새 토큰 자동 상속)
  lib/
    ui/                              # ← 신규
      tokens.css                     # The Stage 토큰 시스템(색/폰트/간격/반경/그림자/동작)
      parent-gate.ts                 # 부모 게이트 산술 과제 순수 함수
      parent-gate.test.ts            # 6 테스트
    components/                      # ← 신규
      Dialog.svelte                  # 인앱 다이얼로그(포커스 트랩·parent-gate)
docs/briefs/M7-RESULT.md             # 이 문서
```

생성물 `src/lib/paraglide/` 는 gitignore. `mathemagics.pdf` 미접근(`git ls-files | grep pdf` → 0건과 동일).

---

## 6. 커밋 (로컬, push 안 함)

```
b574dda feat(ui): The Stage design system — tokens + Pretendard typography + button system + microinteractions (M7)
dad76c4 feat(ui): apply The Stage to routes/components + in-app Dialog (closes M0 #3) (M7)
(직전) docs(m7): M7 브리프 + 결과 보고서 (The Stage 안티-AI-슬롭 리디자인)
```
> 문서 커밋은 자기참조 해시라 생략(amend 때마다 바뀜). 두 feat 커밋 해시는 안정.
`git status -sb` → `## main...origin/main [ahead 7]`(이전 4 + M7 3). **push 안 함**(브리프 §6 규약).

---

## 7. 미해결 이슈 / 다음 마일스톤 인계 사항

| # | 항목 | 심각도 | 비고 |
|---|---|---|---|
| 1 | **반응형 시각 실측** | **해결** | **§8 e2e 로 실측 통과**. 320/375/414/768px × 4 라우트(profiles/home/settings/playground) 에서 가로 스크롤 0 · 인터랙티브 요소 뷰포트 내 함입 단언 + 스크린샷 16종 증거 |
| 2 | **Dialog DOM 동작** | **해결** | **§8 e2e 로 실측 통과**. 포커스 입력칸 이동 · aria-modal/labelled · 포커스 트랩 양끝 순환 · ESC 닫힘+트리거 포커스 복귀 · 배경클릭 닫힘 · parent-gate 오답 비활성/정답 통과+삭제 |
| 3 | **스크린리더(VoiceOver/NVDA) 실측** | **일부 진전** | axe-core 정적 감사(§8) 로 profiles/home/settings/playground/dialog-open 의 WCAG 2.0/2.1 A·AA critical·serious 위반 0건 확인. **단 axe ≠ 실 SR 낭독** — 동적 포커스 순서·낭독 체감은 여전히 사람 실측 필요(M0 인계 #10 계속) |
| 4 | **Pretendard 오프라인 미캐싱** | **해결** | vite.config.ts workbox.runtimeCaching 에 `cdn.jsdelivr.net` CacheFirst(30일) 추가 — 첫 방문 후 오프라인에서도 Pretendard 유지 |
| 5 | **Home "공연 시작" CTA** | **해결(기존 완료)** | M2/M3/M5/M6 가 열려 Home CTAs 가 이미 실제 라우트로 연결중(practice/lessons/stage/magic/catch/memory). 본 문서 상단 주석(비활성이라던)이 부실해 정정함. 기능은 정상 |
| 6 | **라이트 color-scheme 미구현** | 낮음 | tokens.css 에 자리만 예약(브리프 §3.1 "라이트는 토큰만预留"). 활성화는 별도 마일스톤 |
| 7 | **Settings·헤더 LocaleSwitcher 중복** | 낮음 | 의도적(빠른 접근 vs 맥락+힌트). 흐름이 산만하면 한쪽 제거 가능 |
| 8 | **(검증 중 발견) `#/profiles` 라우팅 미도달** | **해결** | PATH_TO_ROUTE 에 `/profiles` 가 없어 워드마크 `href="#/profiles"` 클릭 시 not-found 분기. `hash-router.svelte.ts` 에 추가로 폐쇄(e2e 로 단언) |
| 9 | **(검증 중 발견) ColumnGrid ARIA 구조** | **해결** | `role="grid"`+`gridcell` 사이 `role="row"` 누락 → aria-required-children/-parent critical 위반. `display:contents` row 래퍼 추가로 구조 완성(레이아웃 불변) |
| 10 | **(검증 중 발견) btn--danger 대비 미달** | **해결** | `--miss` 텍스트 on miss-wash 배경 ~4.46:1(WCAG AA 4.5:1 미달). `--house-bright`(~11:1)로 변경 — 적색 의미는 wash+테두리가 유지 |

---

## 8. 사후 검증 패스 — Playwright + axe-core 실측 (브라우저 자동화)

M7 본 구현 종료 후 §7 의 "미검증" 항목(반응형·Dialog DOM·접근성)을 **실측**으로 전환하기 위해
별도의 브라우저 e2e 검증 계층을 추가했다. vitest(node, DOM 없음)와 완전 분리 — `npm test` 는 그대로
기존 365 단위테스트만, `npm run test:e2e` 가 새 검증을 담당한다. **런타임 의존성 0 추가**(전부 devDependencies).

### 8.1 추가된 것

| 항목 | 경로 | 비고 |
|---|---|---|
| devDependencies | `@playwright/test`, `@axe-core/playwright` | dev 전용 — `npm audit --omit=dev` 0건. 프로덕션 번들 영향 0 |
| 설정 | `playwright.config.ts` | `webServer` 가 `vite build && vite preview` 로 **프로덕션 빌드**를 띄워 검증(개발 서버 아님) |
| 스펙 | `e2e/responsive.spec.ts` · `e2e/dialog.spec.ts` · `e2e/a11y.spec.ts` · `e2e/helpers.ts` | 26 테스트 |
| 스크립트 | `package.json` `"test:e2e": "playwright test"` | 기존 check/test/build 불변 |
| 산출물 | `e2e/artifacts/`(스크린샷 16) · `e2e/test-results/` · `e2e/report/` | 전부 `.gitignore`(재생성 가능) |

### 8.2 검증 결과 — 26/26 통과

```
$ npx playwright test --reporter=line
PASS (26) FAIL (0)
Time: 12589ms
```

- **반응형(16)** — 320/375/414/768px × profiles/home/settings/playground. 각 폭에서
  `document.scrollWidth - innerWidth ≤ 0`(가로 스크롤 0) 단언 + 모든 button/a/input 의 우측 끝이
  뷰포트 내임을 단언. full-page 스크린샷 16종을 `e2e/artifacts/screenshots/` 에 증거로 기록.
- **Dialog DOM(5)** — prompt 변형: 입력칸 자동 포커스(rAF 후) · `aria-modal`/`aria-labelledby` ·
  포커스 트랩(첫↔끝 Shift+Tab/Tab 순환) · ESC 닫힘 + 트리거 버튼으로 포커스 복귀 · 배경 클릭 닫힘.
  parent-gate 변형: 오답("0") → 확인 `disabled`, 정답(과제 `a + b` 를 읽어 합 산출) → 확인 활성 →
  클릭 시 프로필 삭제(빈 상태 카드로 전환). 라우팅: `#/profiles` 도 profiles 도달(§7 #8).
- **접근성 axe-core(5)** — profiles/home/settings/playground/dialog-open. WCAG 2.0/2.1 A·AA 태그로
  감사. critical/serious 위반 **0건**(검증-중-발견 결함 2종 수정 후, §8.3).

### 8.3 검증으로 발견·수정한 결함 (위 §7 #8~#10 과 동일)

1. **`#/profiles` 라우팅** — `hash-router.svelte.ts` PATH_TO_ROUTE 에 `/profiles` 추가. 워드마크 링크가
   not-found 로 떨어지던 잠재 결함. e2e `라우팅` 테스트로 단언.
2. **ColumnGrid ARIA 구조(critical)** — `role="grid"` 안에 `role="row"` 없이 `gridcell` 이 직접 위치해
   aria-required-children/-parent 위반. `display:contents` 인 `<div role="row" class="gridrow">` 래퍼로
   grid>row>gridcell 구조 완성. CSS 그리드 레이아웃은 불변(셀이 여전히 부모 grid 에 직접 참여).
3. **`.btn--danger` 대비(serious)** — `--miss`(#ff6b6b) 텍스트 on miss-wash 배경이 ~4.46:1 로 WCAG AA
   4.5:1 에 미달. `color: var(--house-bright)`(~11:1)로 변경. 적색 의미는 miss-wash 배경 + miss 테두리가
   유지하므로 음성은 보존됨.

### 8.4 솔직한 한계 (거짓 성공 주장 금지)

| 항목 | 상태 |
|---|---|
| **반응형 시각** | 자동화 단언(스크롤 0·요소 함입)은 통과했으나, 미학적 레이아웃(자간·여백 감각·2줄 버튼 가독성) 은 스크린샷을 사람이 눈으로 확인해야. 증거는 `e2e/artifacts/screenshots/` |
| **스크린리더 낭독** | axe-core 는 정적·구조적 위반만 잡는다. VoiceOver/NVDA 의 동적 포커스 순서·낭독 흐름·라이브 영역 체감은 **자동화 불가 → 사람 실측 필요**(M0 인계 #10 계속). axe 통과 = SR 완벽 이 아님 |
| **다중 브라우저** | chromium 1종만. Safari(WebKit)·Firefox 교차 검증은 별도(`projects` 추가로 확장 가능) |
| **오프라인 Pretendard 캐싱** | workbox 설정은 추가했으나, 실제 SW 동작(오프라인에서 캐시 히트) 실측은 e2e 범위 밖 — DevTools Application 패널에서 사람 확인 권장 |

### 8.5 최종 회귀 — 전 파이프라인 통과

```
$ npm run check    → svelte-check 0 errors / 0 warnings
$ npm test         → 28 files / 365 tests passed
$ npm run build    → dist OK (JS 387.72KB gzip 121.11KB, CSS 45.80KB gzip 8.11KB)
$ npm run test:e2e → 26 passed (chromium)
```
