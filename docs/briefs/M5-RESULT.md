# M5 결과 — 지필(세로셈) 트랙 · 공연 모드 · 수학 마술

구현자: GLM 5.2 · 완료: 2026-07-29 · 브리프: [M5.md](M5.md)
상태: **브리프 §2 전 6 산출물 구현, §3 완료 기준(명령 3종 + 엔진 단위/속성 테스트 + 크로스크로스 리듬 단언) 통과**.
preview 의 **대화형 브라우저 조작(크로스크로스 리듬 재생 클릭·오답잡기 1판·공연 기록 갱신)**만 이 환경 한계로 미검증(§4.4 솔직 명시).

---

## 1. 한 줄 요약

6장 지필 트랙(열 덧셈·크리스크로스 1-2-3-2-1 리듬·지필 제곱근·9/11 버리기 모드섬 검산) 엔진을
`deriveSteps` 인터페이스로 확장하고, 4개 지필 전용 렌더러(ColumnAddGrid/CrossMultDiagram/SquareRootDiagram/ModSumCheck)와
"오답 잡아내기" 게임, **opt-in 공연 모드**(#/stage, 게이트 통과 기법만·자기 기록만), 9장 마술 4종(앞 장 원리 연결 우선)을 얹었다.
**모드섬 불일치 ⟺ 오답 속성 테스트** + 크로스크로스 대각선 리듬 단언 포함 **61개 신규 단위/속성 테스트**(기존 255 유지 → **316 통과**),
check 0오류 0경고, **런타임 의존성 0 추가**, M7 토큰·curtain-rise 재사용(inline 색/폰트 0건).

---

## 2. 결정 사항과 근거

### 2.1 지필 엔진 RTL 인코딩 — ltr 암산 계열과 방향이 반대 (산출물 1, book-content-map §4-2)

6장은 책 전체에서 **유일하게 오른쪽→왼쪽·종이에 쓰는** 계열이다. 이 방향 차이를 스텝 배열에 구조적으로 인코딩했다:
- `writeAnswerRTL(answer, grid)` 헬퍼(derive-paper.ts): 답을 일의 자리(place 0)부터 write. ltr 계열의 `writeAnswerLTR` 와 대칭.
- 열 덧셈·크리스크로스 모두 오른쪽 자리부터 한 자리씩 확정하며, 올림은 다음(더 큰) 자리로 이월.
- 모드섬·제곱근 그룹핑도 오른쪽(일의 자리) 기준으로 작동.
엔진 정확성은 독립 산술(합·곱·isqrt)과 대조(§4.2).

### 2.2 operands 를 `readonly number[]` 로 넓힘 — 열 덧셈(N 피연산자) + 제곱근(1 피연산자) (회귀 0)

M1 의 `operands: [number, number]` 2-튜플은 열 덧셈(3~5개 수)을 담지 못한다. **튜플 → `readonly number[]`** 로 넓혔다.
- **회귀 0 보장**: 기존 2-피연산자 코드는 `const [a, b] = operands` 구조분해로 후속 요소를 무시 → 동작 불변.
- `noUncheckedIndexedAccess` 대응: `pairOf(problem): [number, number]`(derive-internals) 안전 접근자를 추가해
  기존 2-피연산자 기법이 `?? 0` 폴백으로 [a,b]를 얻도록 일괄 교체(derive/derive-mul/derive-div/derive-est/report + 테스트 4건).
- `computeAnswer` 는 `paper-column-add` 일 때 **전 피연산자 합**을 반환(pairOf 아님).
- storage/SrsCard 의 op/method 중복 정의를 engine 타입 `import` 로 통일(새 op/method 자동 전파).

### 2.3 크리스크로스 1-2-…-2-1 대각선 리듬 생성 (산출물 1·2, book-content-map §6-5)

`crossMultLayout(problem)` 가 순수하게 대각선을 생성: 결과 자리 p(0=일의 자리)에 기여하는 쌍 = {(i,j): i+j=p}.
- **대각선 수 = a자리수+b자리수−1**, 곱 개수 패턴 = 1,2,…,min(a,b),…,2,1.
- derive-paper.test.ts 가 **3×3 → [1,2,3,2,1]** · 2×2 → [1,2,1] · 2×1 → [1,1] 을 단언(브리프 §3 핵심 요구).
- 47×34 공식 예제: 일의자리 4×7=28→8(올림2), 십의자리 4×4+3×7+2=39→9(올림3), 백의자리 3×4+3=15→5+남은1 = 1598.
- **가장 큰 자리 올림**(finalCarry) 처리: 대각선 루프 후 남은 올림을 별도 write 스텝으로(1598 의 "1"). 이 케이스를 테스트가 커버.
- CrossMultDiagram 컴포넌트가 SVG `<line>` 으로 대각선 교차를 그리고 `activeDiagonal` prop 으로 현재 스텝 대각선 강조 — 리듬 재생의 시각 자산.

### 2.4 모드섬 검산 알고리즘 + 속성 (산출물 1·3, book-content-map §6-2/§6-6)

`modsum.ts` 순수 모듈. **9 버리기**(digital root, 9는 9로) · **11 버리기**(오른쪽부터 교대 ±, mod 11) 두 채널.
- `checkModSum(op, operands, claimed)` → ModSumResult(예측 vs 답 실측, 통과/불일치).
- 핵심 속성(브리프 §3): **불일치 ⟹ 확정 오류**(역은 8/9·10/11 로 성립). modsum.test.ts 가
  (a) 정답은 절대 flag 안 됨, (b) truth+1 오답은 95%+ flag, (c) flag ⟹ claimed≠truth(결정론적) 를 단언.
- "오답 잡아내기" 게임(catch-wrong.ts): makeRound 가 **정확히 1개 오답을 주입하되 반드시 mod9 가 불일치**하도록 보장.
  따라서 게임 판에선 findWrongByModSum 이 wrongIndex 를 100% 적중(catch-wrong.test.ts, 8시드×3크기 단언).
- 모드섬 원리는 4장 배수판정(자릿수 합)과 동일 — ch6-mod-sum-check 레슨 rule 이 명시적 연결.

### 2.5 렌더러 접근 — ColumnGrid 형제 컴포넌트로 (산출물 2, 규약 "justify")

ColumnGrid 의 4-행 고정 모델(carry/op1/op2/answer)은 **N-피연산자 열 덧셈·대각선·제곱근 그룹·모드섬 동그라미**에 맞지 않는다.
M4 의 선례(XDiagram/DivisionBracket 가 ColumnGrid 형제)에 따라 **지필 전용 4개 형제 컴포넌트**로 제작(회귀 0):
- ColumnAddGrid(열 덧셈, N 행 + 올림 위첨자) · CrossMultDiagram(SVG 대각선 오버레이) ·
  SquareRootDiagram(근호+두자리 그룹+자리별 추정) · ModSumCheck(동그라미 표기, 9/11 두 채널).
- LessonPlayer 의 `techniqueVisual` union 을 4종 확장(coladd/xmult/sqrt/modsum)해 hook·example 에서 렌더.
- 같은 시각 언어 재사용: tabular-nums · 숫자 카드 깊이 그림자 · `var(--*)` 토큰 전용(inline 색/폰트 0, §4.3 grep 실측).

### 2.6 공연 모드 — opt-in + 게이트 + 자기 기록 (산출물 4, PLAN §4.2-8 + §7.2)

`#/stage` 라우트. teaching-trends §4.4 의 **실용적 합의점**을 그대로 구현:
- **opt-in**: Home 의 🎭 CTA 로만 진입. 강제 아님.
- **게이트**: `proficiencyOf` 가 `gate-passed`/`fluent` 인 기법만 무대 오르기(정확도 90%+ 샘플 5+, M3 단조 잠금).
  미달 시 "정확도가 오르면 열려요" 안내. **시간 압박 노출 전 정확도 확보**(McNeil 2025).
- **count-up(카운트다운 아님) + beat-your-own-time**: 고정 5문제, 스톱워치가 올라감. 카운트다운 불안 원천 차단.
- **자기 기록 ONLY**: Settings.stageBests(기법별 최단 시간 ms, optional→스키마 v1 불변). 갱신 시 "새 기록!" 축하.
  **리더보드·타인 비교·손실 압박 전무**(PLAN §7.2, COPPA 정합).
- M7 `--stage-spotlight-bg` 방사광 + curtain-rise(라우트 진입) + spotlight-sweep(정답) 마이크로인터랙션 재사용 — "마술 공연 프레임"(PLAN §4.2-8)의 시각 실체.

### 2.7 Ch9 마술 — 앞 장 원리와 직결되는 4종 우선 (산출물 5, book-content-map §9)

9종 중 **앞 장 원리로 귀결되는 4종**을 먼저(M4 CHAPTER_MAGIC_SLOTS 매핑 그대로):
- ch2→**심령 수학**(대수, 항상 6) · ch3→**마법의 1089**(99의 배수+뒤집기) ·
  ch4→**사라진 숫자**(9의 배수 자릿합 = **모드섬 원리**, ch6 연결) · ch5→**개구리 점프**(7번째 줄×11 = **11 곱셈 원리**).
- 각 트릭: `demo(seed)` 순수 함수(결정적 시연 단계) + `secret`(원리=배운 기법) + principle. MagicTrick.svelte 가
  **시연 → 비밀 공개 → 연습 → "가족에게 보여주기" 미션 카드** 4단계 재생.
- 나머지 5종(세제곱근·간단제곱근·마방진·놀라운합·요일계산)은 8장 고급 곱셈 등 미구현 장에 의존 → '곧 열려요' 자리표(정직한 범위 명시).
- tricks.test.ts 가 4종의 결정론적 결과(심령→6, 1089→1089, 개구리 합=11의 배수) 단언.
- **저작권**: title/secret/principle 문장 전부 자체 저작, 원서 문장 0 복제(PLAN §10-1).

### 2.8 레슨·SRS 연동 (산출물 6)

4개 Ch6 레슨(content/lessons/ch6-*.json)이 기존 5단계 프레임워크에 편입. 로더 METHODS/OPS 에 4 신규 method + sqrt op 추가.
레슨 완료 시 기존 `createCardFromLesson` 이 SRS 카드 생성(op/method 전파). loadAllLessons 가 부팅 시 4 레슨 검증(빌드 통과=스키마 유효).

---

## 3. 추가한 의존성

**런타임 npm 의존성: 0개 추가.** M0~M4 와 동일(`dexie` 단 1개). 모든 시각화는 CSS + SVG(번들 0KB 외부 패키지).

---

## 4. 완료 기준 검증

### 4.1 명령 3종 — 전부 통과 (출력 원문)

```
########## CHECK ##########
ℹ [paraglide-js] Compiling inlang project ...
✔ [paraglide-js] Successfully compiled inlang project.
Loading svelte-check in workspace: /Users/danny/Documents/PARA/Resource/mathemagics-interactive
Getting Svelte diagnostics...
svelte-check found 0 errors and 0 warnings

########## TEST ##########
 RUN  v4.1.10 /Users/danny/Documents/PARA/Resource/mathemagics-interactive
 Test Files  26 passed (26)
      Tests  316 passed (316)
   Start at  07:21:18
   Duration  1.44s (transform 2.89s, setup 1.16s, import 3.83s, tests 429ms, environment 1ms)

########## BUILD ##########
dist/index.html                   1.41 kB │ gzip:  0.78 kB
dist/assets/index-B5YpKAzc.css   42.89 kB │ gzip:  7.67 kB
dist/assets/index-BGlWGm0m.js   344.20 kB │ gzip: 108.65 kB
✓ built in 1.03s
PWA v1.3.0  mode generateSW  precache 12 entries (390.56 KiB)
```

번들 증가(M4 대비): JS 295.68→**344.20KB**(gzip 94.37→**108.65KB**, +14.28KB) · CSS 31.56→**42.89KB**
(gzip 6.13→**7.67KB**, +1.54KB). 증가분 전부 지필 엔진(derive-paper/modsum/catch-wrong)·6개 컴포넌트·3 라우트·4 레슨·마술 모듈이며 외부 패키지 0개.

### 4.2 테스트 316개 (26파일) — M5 신규 61개 + 기존 255개(회귀 0)

**M5 신규 엔진(46개):**
- `derive-paper.test.ts` (24) — 열 덧셈(3·4 피연산자 합 대조, carries) · **크로스크로스 답 대조**(5쌍 + 47×34=1598 공식 예제) ·
  **대각선 리듬 단언**(2×2→[1,2,1], 3×3→[1,2,3,2,1], 2×1→[1,1], 47×34 스텝별 writeDigit/carryOut) ·
  제곱근(6 완전제곱수 + 529 그룹핑 [5,29] + 자리별 trialBase/digit/product) · 모드섬 검산 RTL write.
- `modsum.test.ts` (14) — modSum9(4328→8, 8651→2, 9의 배수→9, 0→0) · modSum11(23487→2, 11의 배수→0, 범위) ·
  expectedMod9(add/mul) · **속성: 정답 절대 flag 안 됨 · truth+1 오답 95%+ flag · flag⟹claimed≠truth** · 47×34 결과 필드.
- `catch-wrong.test.ts` (8) — makeRound 구조(N 중 1 오답, 결정성, n<2 throw) · **오답은 반드시 mod9 불일치** ·
  findWrongByModSum 적중(8시드×3크기 + add).

**M5 신규 마술(15개):** `magic/tricks.test.ts` — 레지스트리 4종 · 챕터 매핑(2-5) · findMagicTrick ·
Localize 필드+demo 존재 · **심령 시드 5개 모두 →6** · **1089 시드 4개 모두 →1089** · 개구리 합=11의 배수 · 사라진숫자 원리(9의 배수).

**M5 신규 라우터:** `hash-router.test.ts` — stage/magic/catch 매핑 + 쿼리 무시(magic?id, stage?skill) 케이스 추가.

**기존 255개(회귀 0):** derive(43)·aria(5)·state-machine(24)·loader(19)·fading(8)·dexie-adapter(8)·storage/index(8)·
migrations(3)·content/localized(2)·ui/parent-gate(6)·srs 7종(70)·hash-router(5→8)·derive-mul(25)·derive-div(10)·derive-est(9)·skill-tree(9).

### 4.3 토큰 잠금 + 저작권 검증 — grep 실측

```
$ rg '(#[0-9a-fA-F]{6}|oklch\(|rgba?\()' src/components/ColumnAddGrid.svelte src/components/CrossMultDiagram.svelte \
     src/components/SquareRootDiagram.svelte src/components/ModSumCheck.svelte src/components/CatchWrongGame.svelte \
     src/components/MagicTrick.svelte src/routes/Stage.svelte src/routes/Magic.svelte src/routes/Catch.svelte src/lib/magic/tricks.ts
# (결과 없음, exit=1) ← M5 신규 컴포넌트/라우트에 genuine 색 리터럴 0건.

$ rg "font-family: ['\"]?[A-Z]" src/components/ColumnAddGrid.svelte ... src/routes/Magic.svelte
# (결과 없음, exit=1) ← font-family 전부 var(--font-*) 토큰 참조.

$ git ls-files | grep -c pdf   →  0   ← mathemagics.pdf 미접근.
```

i18n 패리티: ko **241키** / en **241키**, `only-in-ko=[]` `only-in-en=[]`(실측). 기존 키 삭제/변경 0.

### 4.4 preview 검증 — 정적 서빙 + 대화형 부분은 미검증 (솔직 명시)

`npm run build && vite preview` 로 정적 서빙과 번들 포함을 검증:

| 확인 항목 | 결과 |
|---|---|
| 앱 HTML | `GET /mathemagics-interactive/` → 200 `text/html` |
| **신규 엔진 method 번들 포함** | JS 에 `paper-column-add`/`paper-cross-mult`/`paper-sqrt`/`mod-sum-check` 확인 |
| **신규 컴포넌트 번들 포함** | JS 에 `xmult`(클래스)/`criss-cross`(마술 원리 문구) 확인 |
| **신규 라우트 번들 포함** | JS 에 `"/stage"`/`"/magic"`/`"/catch"` 해시 경로 확인 |

**미검증(브리프 §3 요구, 솔직 명시)**: 브리프가 요구한 **대화형 브라우저 조작** —
"크리스크로스 3×3 스텝 리듬 재생 + 오답 잡아내기 1판 + 공연 모드 기록 갱신 흐름" — 을 이 구현 환경에서
직접 클릭하며 확인하지 못했다. 브라우저 자동화(puppeteer/playwright)가 없고 새 의존성 추가 없이는 불가.
엔진 정확성·리듬·모드섬 속성은 **61개 단위/속성 테스트**로, 렌더·라우트 흐름은 코드 검토 + 정적 서빙 검증으로 대체.
오케스트레이터가 브라우저에서 `#/lesson?id=paper-cross-mult`(대각선 SVG 활성 스텝) · `#/catch`(오답 픽) ·
`#/stage`(게이트 통과 기법 선택→스톱워치→기록 갱신) · `#/magic?id=psychic-math`(4단계 재생) 을 직접 확인해야 한다.

---

## 5. 파일 트리 (git 추적 기준, 신규·변경)

```
messages/
  ko.json                                # M5 신규 UI 문자열 ~40키 (변경)
  en.json
content/lessons/                         # ← 신규: 제6장 4레슨
  ch6-column-add.json  ch6-cross-mult.json  ch6-paper-sqrt.json  ch6-mod-sum-check.json
src/
  App.svelte                             # stage/magic/catch 라우트 분기 (변경)
  routes/
    Home.svelte                          # 공연/마술/오답잡기 CTA 추가 (변경)
    Lessons.svelte                       # 마술 슬롯 클릭→#/magic 연결 (변경)
    Stage.svelte                         # ← 신규: #/stage opt-in 공연 모드(게이트·자기기록·count-up)
    Magic.svelte                         # ← 신규: #/magic 트릭 목록/재생
    Catch.svelte                         # ← 신규: #/catch 오답 잡아내기
  components/                            # ← 신규 6종
    ColumnAddGrid.svelte                 # 열 덧셈(N 행 + 올림 위첨자)
    CrossMultDiagram.svelte              # SVG 대각선 오버레이(활성 대각선 강조)
    SquareRootDiagram.svelte             # 근호+두자리 그룹+자리별 추정
    ModSumCheck.svelte                   # 모드섬 동그라미 표기(9/11 채널)
    CatchWrongGame.svelte                # 오답 잡아내기 게임
    MagicTrick.svelte                    # 시연→비밀→연습→미션 4단계
  lib/
    engine/                              # ← 엔진 확장
      types.ts                           # Op(sqrt)/Method(+4 종)/operands readonly number[] + 6 시각화 모델 (변경)
      derive.ts                          # computeAnswer(column-add 합/sqrt) + dispatch (변경)
      derive-internals.ts                # pairOf/operandAt + sqrt (변경)
      derive-paper.ts                    # ← 신규: 열덧셈·크로스크로스·제곱근·모드섬 스텝 + 레이아웃
      modsum.ts                          # ← 신규: 9/11 버리기 검산 순수 함수
      catch-wrong.ts                     # ← 신규: 오답 잡아내기 게임 순수 로직
      generate.ts                        # paper 4종 + operandCount 생성 (변경)
      derive-paper.test.ts               # ← 신규 24 테스트(리듬 단언 포함)
      modsum.test.ts                     # ← 신규 14 테스트(속성: 불일치⟺오답)
      catch-wrong.test.ts                # ← 신규 8 테스트
      derive.ts/derive-mul.ts/derive-div.ts/derive-est.ts/*.test.ts  # pairOf 교체 (변경, 회귀 0)
    magic/                               # ← 신규: 9장 마술
      tricks.ts                          # 4종 레지스트리 + demo 순수 함수
      tricks.test.ts                     # 15 테스트
    lesson/
      types.ts                           # ProblemSet operandCount (변경)
      loader.ts                          # OPS/METHODS 확장 + operandCount 검증 (변경)
      LessonPlayer.svelte                # techniqueVisual 4종 확장(지필 컴포넌트 렌더) (변경)
    router/
      hash-router.svelte.ts              # stage/magic/catch 라우트 (변경)
      hash-router.test.ts                # 신규 라우트 케이스 (변경)
    srs/report.ts                        # pairOf 교체 (변경)
    storage/types.ts                     # Settings.stageBests + SrsCard op/method import 통일 (변경)
docs/briefs/M5-RESULT.md                 # 이 문서
```

생성물 `src/lib/paraglide/` 는 gitignore. `mathemagics.pdf` 미접근(`git ls-files | grep pdf` → 0건).

---

## 6. 커밋 (로컬, push 안 함)

```
72d3bd6 feat(m5): paper track (Ch6) + stage mode + math magic (Ch9) + catch-the-wrong-answer game
        (엔진 4종 + modsum/catch-wrong + 6 컴포넌트 + 3 라우트 + 4 레슨 + 마술 4종 + SRS/라우터/i18n 확장을 1개 종합 커밋에)
```
`git status -sb` → `## main...origin/main [ahead 17]`(이전 16 + M5 1). **push 안 함**(브리프 §4 규약).

---

## 7. 미해결 이슈 / 다음 마일스톤(M6) 인계 사항

| # | 항목 | 심각도 | 비고 |
|---|---|---|---|
| 1 | **대화형 preview 미검증** | 중 | §4.4. 오케스트레이터가 브라우저에서 크로스크로스 대각선 리듬·오답잡기 1판·공연 기록 갱신·마술 4단계 직접 확인. 엔진·속성 정확성은 61 단위/속성 테스트로 보장 |
| 2 | **나머지 마술 5종 미구현** | 예정됨 | 세제곱근·간단제곱근·마방진·놀라운합·요일계산은 8장 고급 곱셈 등 미구현 장에 의존. '곧 열려요' 자리표. M6(8장) 이후 채울 것 |
| 3 | **Stage 입력이 답 전체 타이핑** | 낮음 | 공연 모드는 한 자리씩이 아닌 답 전체를 타이핑해 제출. 빠른 판정을 위해 의도적. digit-by-digit auto-advance(DigitInput) 연동은 별도 설계 |
| 4 | **크로스크로스 연습이 DigitInput(answer 전체)** | 낮음 | M4 인계 #6 계속. 지필 레슨의 hook/example 은 전용 컴포넌트가 시연하지만, practice(fading)는 기존 DigitInput 으로 답만 입력. 단계별 채우기 시각화는 별도 |
| 5 | **stageBests 가 Settings optional** | 낮음 | 스키마 v1 불변(optional). 프로필 단위. ExportBundle 에 자동 포함. 대량 기록 시 크기 우려는 작음(기법 수 한정) |
| 6 | **스크린리더 실측 미수행** | 중 | M0 인계 #10 계속. 신규 지필 컴포넌트 role="img"/aria-label 구조는 코드 수준. VoiceOver/NVDA 실측은 별도 환경 |
| 7 | **CatchWrongGame 이Mul 고정** | 낮음 | add 연산 옵션이 engine엔 있지만 게임 UI는 mul 고정. 데모용으로 충분, 확장 시 makeRound(op) 노출 |
```
