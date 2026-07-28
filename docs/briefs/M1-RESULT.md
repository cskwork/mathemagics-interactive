# M1 결과 — 계산 코어 (스텝 엔진 + 세로셈 렌더러 + 입력)

구현자: GLM 5.2 · 완료: 2026-07-29 · 브리프: [M1.md](M1.md)
상태: **브리프 §2 전 7항 구현, §3 완료 기준(명령 3종 + 엔진 단위테스트 + 접근성 라벨 테스트) 검증 통과**.
preview 의 **대화형 브라우저 조작(애니메이션 재생/직접 입력 클릭)**만 이 환경에서 불가하여 미검증(§4.3 참고).

---

## 1. 한 줄 요약

덧셈·뺄셈 × ltr(벤저민식)/rtl(학교식) 전 조합에 대해 `문제 → 스텝 파생 → 그리드 렌더 → 애니메이션 재생/학생 입력`
파이프라인이 섰다. 엔진은 순수 함수이고 답이 항상 독립 산술(`a+b`)과 일치하며(74 테스트),
`#/dev/playground`에서 두 모드를 전환하며 확인할 수 있다. **새 의존성 0개**.

---

## 2. 결정 사항과 근거

### 2.1 세로셈 렌더링 — 커스텀 CSS Grid (자릿수 1개 = 셀 1개)

PLAN §5.1 / 리서치 §1.3 확정대로. `display:grid` + `grid-template-columns: repeat(cols)` 로 carry·op1·op2(부호+밑줄)·answer
행을 같은 열 트랙에 정렬. `font-variant-numeric: tabular-nums` + `font-feature-settings:'tnum'` 로 숫자 폭 고정(자릿수 정렬의 필수 조건).
받아내림은 셀 `::after` 의 `transform:rotate(-32deg)` 사선(리서치 §1.3 "손으로 그은 사선" 느낌). 번들 0KB.

### 2.2 그리드 좌표계 — `행.열` 문자열 주소 + 자릿값 매핑

리서치 §4 후보 B 의 `"row.col"` 주소를 그대로 쓴다(예: `"answer.c4"`). 열은 `c1`(부호) + `c2..cN`(자릿값) 이고
가장 오른쪽 자릿값 열 = 일의 자리(place 0). `deriveGrid` 가 `placeValueOf[col]` 맵을 만들어 aria-label 과 스텝 좌표가
같은 좌표계를 공유. 자릿값 열 수 = `max(피연산자 자릿수, 답 자릿수)` — `999+1=1000`(답 자릿수 증가)·`1000-1=999`(선행 0 생략) 커버.

### 2.3 올림/빌림 인코딩 — 방향에 따라 다르다 (이것이 ltr/rtl 의 본질적 차이)

- **rtl(학교식)**: `carry` 스텝(carry 행에 위첨자 숫자) + `strike` 스텝(op1 셀 취소선)을 **명시적 스텝**으로 생성.
  답 칸 write 는 우→좌 순서. 348+257 → carry.c3·carry.c2, 732−458 → strike op1.c3·op1.c2.
- **ltr(벤저민식)**: 올림/빌림 **표기 없음**(머릿속 처리). 답 칸은 좌→우로 최종값 채움.
  running-total chunk narration(book-content-map §1: 큰 덩어리부터 더한다) + digit-reveal.
  "뒤 자릿수로 인한 수정 처리"는 — `carryIn[place]` 가 0이 아닌 자리에서 narration 이 명시적으로
  "올림 N을 받아 X→Y 수정" 설명(derive.ts 주석 §2). 그리드는 항상 최종 정답을 표시.

이 차이가 step 배열에 구조적으로 드러난다(rtl 은 carry/strike 스텝 존재, ltr 은 부재). 테스트가 이를 단언(derive.test.ts).

### 2.4 보수(complement) 뺄셈 — narration 분기

브리프 §2-2 "보수 변형은 스텝 narration 분기로 지원". ltr 뺄셈에서 어떤 자리가 빌림을 필요로 하면
narration 이 "올려 빼고 되돌려줍니다"(book-content-map §1-5 round-up) 분기로 전환(derive.ts `deriveSubLTR`).
계산 결과는 동일(독립 `a-b`와 대조). 풍부한 보수 연출 자체는 M2 콘텐츠 저작 영역.

### 2.5 애니메이션 — CSS transition + 단일 setTimeout 시퀀싱 (Motion mini 미사용)

리서치 §3.2 의 1순위(CSS) 채택. StepPlayer 는 "현재 스텝 인덱스" 하나로 재생/일시정지/이전/다음/속도(1x·0.5x)를
전부 구현(리서치 §3.1 스텝 상태기계). 자동 재생은 스텝 duration 후 다음 스텝으로 가는 `setTimeout` 하나.
**Motion mini(~5KB) 미사용 사유**: 직렬 단계 시퀀싱이 전부라 병렬/스프링이 필요 없고, 의존성 0 정책(브리프 §4)을 유지.
`prefers-reduced-motion` 시 duration 을 120ms 캡(사실상 즉시 전환) + shake 애니메이션 제거(ColumnGrid CSS).

### 2.6 auto-advance 방향 — step 배열 순서에 인코딩 (별도 로직 없음)

DigitInput 은 `expect:true` 인 write 스텝(답 칸)만 학생 입력 대기 지점으로 쓴다. 이 스텝들이 steps 배열에
**풀이 순서**로 들어 있으므로(rtl→우~좌, ltr→좌~우), 커서를 순서대로 옮기기만 하면 auto-advance 방향이 자동으로 정해진다.
방향 분기 if 문 없음. 올림/빌림 표기(carry/strike)는 다음 입력 직전까지 자동 공개(frontier 알고리즘)돼 학생이 캐리를 보고 다음 자리를 친다.

### 2.7 접근성 — aria-label 생성 로직을 순수 함수로 분리(`aria.ts`)

PLAN §5.3 / 리서치 §1.5. 각 셀의 `aria-label`("십의 자리, 7", "백의 자리 받아올림 1", "일의 자리 답 칸")을
ColumnGrid 안에 두면 DOM 없이 테스트할 수 없어 `cellAriaLabel(rowId, place, value, op)` 순수 함수로 분리.
ColumnGrid 와 aria.test.ts 양쪽이 사용. 텍스트는 전부 Paraglide 컴파일 메시지(m.*) — 하드코딩 UI 문자열 없음.

**"DOM 순서 = 풀이 순서" 해석**: 2D 그리드에서 DOM 소스 순서는 시각 순서(위→아래/좌→우)로 유지하고,
단계별 낭독은 별도 `aria-live="polite"` 영역이 스텝 배열 순서(=풀이 순서)로 읽는다(리서치 §1.5 권장 패턴).
CSS Grid 시각 재배치가 낭독 순서를 바꾸지 않는다는 리서치 경고에 부합.

### 2.8 playground 라우트 — 프로필 없이 접근, 내비게이션 숨김

`#/dev/playground`. App.svelte 의 "프로필 없으면 profiles 로" 가드에 `playground` 예외를 둬 프로필 선택 없이 진입 가능.
라우터에 route 추가(`hash-router.svelte.ts`). URL 쿼리(`?op=add&method=ltr&digits=3&carry=1&mode=animation`)로 초기값 지정.
내비게이션 링크는 없고 직접 URL 진입만. 모드 전환(애니메이션/직접 입력) 시 `{#key}` 로 컴포넌트 재마운트(내부 상태 초기화).

---

## 3. 추가한 의존성

**없음.** 클라이언트 런타임 의존성은 M0 와 동일(`dexie` 단 1개). 번들 156KB → 179.64KB(gzip 53.7→61.8KB) 증가분 ~23.5KB 는
전부 새 엔진+컴포넌트 코드이며 외부 패키지 0개. Motion mini 도 도입하지 않았다(§2.5 사유).

---

## 4. 완료 기준 검증

### 4.1 명령 3종 — 전부 EXIT=0 (출력 원문)

```
$ npm run check

> mathemagics-interactive@0.0.0 check
> npm run i18n && svelte-check --tsconfig ./tsconfig.json


> mathemagics-interactive@0.0.0 i18n
> paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide --strategy baseLocale

ℹ [paraglide-js] Compiling inlang project ...
✔ [paraglide-js] Successfully compiled inlang project.
Loading svelte-check in workspace: /Users/danny/Documents/PARA/Resource/mathemagics-interactive
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
EXIT=0

$ npm test

> mathemagics-interactive@0.0.0 test
> vitest run


 RUN  v4.1.10 /Users/danny/Documents/PARA/Resource/mathemagics-interactive


 Test Files  7 passed (7)
      Tests  74 passed (74)
   Start at  05:29:54
   Duration  606ms (transform 892ms, setup 240ms, import 1.11s, tests 119ms, environment 1ms)

EXIT=0

$ npm run build

> mathemagics-interactive@0.0.0 build
> vite build

vite v8.1.5 building client environment for production...
✔ [paraglide-js] Compilation complete (message-modules)
✓ 217 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                0.18 kB
dist/manifest.webmanifest         0.62 kB
dist/index.html                   1.04 kB │ gzip:  0.53 kB
dist/assets/index-CAqVvfbv.css    4.24 kB │ gzip:  1.40 kB
dist/assets/index-CkBbZceD.js   179.64 kB │ gzip: 61.81 kB

✓ built in 582ms

PWA v1.3.0
mode      generateSW
precache  12 entries (191.75 KiB)
files generated
  dist/sw.js
  dist/workbox-abeb32eb.js
EXIT=0
```

### 4.2 테스트 74개 (7파일) — M1 신규 48개 + M0 기존 26개

**M1 신규:**

- `src/lib/engine/derive.test.ts` (43) —
  - **답 대조(핵심)**: add/sub × ltr/rtl × 2~4자리 × 올림/빌림 유무 **전 48조합** 각각 생성기로 문제 생성 →
    파생된 답칸 값들을 합친 결과가 독립 `a+b`/`a-b` 계산과 일치하는지 단언. 마지막 답이 항상 맞음.
  - 방향·인코딩: rtl 덧셈 답칸 우→좌 + carry 스텝 2개 / rtl 덧셈(올림 없음) carry 0개 / ltr 덧셈 답칸 좌→우 + carry 스텝 부재 /
    rtl 뺄셈 strike 스텝 2개(op1.c3·op1.c2) / rtl 뺄셈(빌림 없음) strike 0 / ltr 뺄셈 답칸 좌→우 + strike 부재.
  - 경계: `999+1=1000`(양방향, 답 자릿수 증가) / `1000−1=999`(선행 0 안 씀, answer.c2 write 스텝 없음 단언) /
    피연산자 0 포함 / 음수 결과 sub 는 throw / 모든 `expect:true` 스텝은 answer 칸의 한 자리 숫자.
- `src/lib/engine/aria.test.ts` (5) — 접근성 라벨: 피연산자 자릿값("십의 자리, 7") / 답 칸 빈·채움 / 받아올림("백의 자리 받아올림 1") /
  부호(add→"더하기", sub→"빼기") / 빈 칸 → 자릿값 이름만.
- `src/lib/router/hash-router.test.ts` (5, M0 5 → 5 유지·playground 케이스 추가) — `/dev/playground` 매핑 + 쿼리 무시.

**M0 기존(변경 없음, 회귀 없음):** dexie-adapter(8) · storage/index(8) · migrations(3) · content/localized(2).

### 4.3 preview 수동 검증 — 부분 검증 + 대화형 부분은 미검증 (솔직 명시)

`npm run build && npx vite preview --port 4173` 로 서버를 띄워 **정적 서빙은 검증**했다:

| 확인 항목 | 결과 |
|---|---|
| base path 리다이렉트 | `GET /` → 302 → `/mathemagics-interactive/` 200 `text/html` |
| JS 번들 | `…/assets/index-CkBbZceD.js` 200, 179549 bytes, `text/javascript` |
| CSS 번들 | `…/assets/index-CAqVvfbv.css` 200, 4245 bytes |
| playground 라우트 번들 포함 | JS 에서 `"dev/playground"` 해시 경로 확인됨 |
| index.html 자산 참조 | 전부 `/mathemagics-interactive/…` 접두 (script/css/manifest/icon) |

**미검증(브리프 §3 요구, 솔직 명시)**: 브리프가 요구한 **대화형 브라우저 조작** —
"playground 에서 ltr 덧셈 1문제 애니메이션 재생 + rtl 뺄셈 1문제 직접 입력 완주" — 을
이 구현 환경에서 직접 클릭하며 확인하지 못했다. 브라우저 자동화 도구(puppeteer/playwright)가 없고
새 의존성 추가 없이는 불가능하여, 엔진 정확성은 48조합 단위테스트로, 렌더·입력 로직은 코드 검토 + 정적 서빙 검증으로 대체했다.
오케스트레이터가 브라우저에서 `#/dev/playground?op=add&method=ltr&digits=3&carry=1&mode=animation`(재생 ▶) 과
`…&op=sub&method=rtl&mode=input`(숫자 패드로 입력) 을 직접 눌러 확인해야 한다.

---

## 5. 파일 트리 (git 추적 기준, 신규·변경)

```
messages/
  ko.json                       # M1 UI 문자열 추가 (playground·player·place·aria·numpad)
  en.json
src/
  App.svelte                    # playground 라우트 분기 + 프로필 가드 예외 (변경)
  lib/
    engine/                     # ← 신규: 계산 코어
      types.ts                  # Problem(후보A) + Step/Grid(후보B) + CellState
      derive.ts                 # deriveSteps / deriveGrid 순수 함수 (add/sub × ltr/rtl)
      derive.test.ts            # 43 테스트 (답 대조 전 조합 + 방향/인코딩/경계)
      generate.ts               # 시드 기반 결정적 문제 생성기 (mulberry32)
      aria.ts                   # cellAriaLabel 순수 함수 (접근성 라벨)
      aria.test.ts              # 5 테스트
    router/
      hash-router.svelte.ts     # playground 라우트 추가 (변경)
      hash-router.test.ts       # playground 케이스 추가 (변경)
  components/                   # ← 신규
    ColumnGrid.svelte           # CSS Grid 세로셈 렌더러 (tabular-nums, carry/밑줄/취소선, 셀 상태)
    StepPlayer.svelte           # 스텝 재생기 (재생/일시정지/이전/다음/처음/속도, aria-live, reduced-motion)
    DigitInput.svelte           # digit-cell 에디터 (auto-advance, 즉시 정오 피드백, 물리 키보드)
    NumPad.svelte               # 가상 넘패드 (1-9/0/⌫/clear, ≥48px)
  routes/
    Playground.svelte           # 데모 라우트 #/dev/playground (파라미터·모드 전환)
```

생성물 `src/lib/paraglide/` 는 gitignore 대상(M0 과 동일). `mathemagics.pdf` 미접근.

---

## 6. 커밋 (로컬, push 안 함)

```
feat(engine): 시맨틱 문제 스키마 + deriveSteps/deriveGrid 순수 엔진 (add/sub × ltr/rtl) + 결정적 생성기
feat(ui): CSS Grid 세로셈 렌더러 + 스텝 재생기 + digit-cell 에디터/넘패드
feat(playground): #/dev/playground 데모 라우트 + i18n 메시지
(+ 이 문서 커밋)
```

---

## 7. 미해결 이슈 / 다음 마일스톤(M2) 인계 사항

| # | 항목 | 심각도 | 비고 |
|---|---|---|---|
| 1 | **대화형 preview 미검증** | 중 | §4.3. 오케스트레이터가 브라우저에서 애니메이션 재생 + rtl 뺄셈 직접 입력 완주를 직접 확인. 엔진 정답 정확성은 48조합 테스트로 보장됨 |
| 2 | **ltr "수정 처리"가 그리드에 시각화되지 않음** | 중(설계 의도) | ltr 은 항상 최종 답만 표시하고 "수정"은 narration 만. 벤저민식 "앞자리 잡았다가 뒤 자리 올림으로 바꾼다"를 write→취소→재write 시각화로 넣을지는 M2 시각 폴리시 결정. 엔진은 정확 |
| 3 | **받아내림 취소선이 숫자를 줄여서 다시 쓰지 않음** | 낮음 | 학교식은 보통 7을 줄이고 6으로 다시 쓴다. M1 은 원래 숫자 위에 사선만. 시각 폴리시는 M2 |
| 4 | **접근성 실측(스크린리더) 미수행** | 중 | aria-label 생성 로직은 단위테스트(§4.2)했으나 VoiceOver/NVDA 실제 낭독은 M2 이후. DOM 순서=시각 순서, aria-live 낭독=풀이 순서로 설계(§2.7) |
| 5 | **DigitInput 키보드 핸들러가 전역 window** | 낮음 | `<svelte:window onkeydown>`. 폼 컨트롤(select/input/textarea) 포커스 중엔 가로채지 않도록 가드 넣었으나, 레슨 화면에서 다른 입력과 충돌 시 M2 에서 스코프 조정 |
| 6 | **generateProblems 중복 한계** | 낮음 | 자릿수 1~2 에선 요청 개수만큼 고유 문제가 부족할 수 있어 throw. 레슨 세트(3~10문제)는 2자리 이상에서 안정적 |
| 7 | **playground 컨트롤 변경이 URL 에 동기화 안 됨** | 낮음 | 초기값만 URL 쿼리에서 읽는다(쓰지 않음). 공유 링크 필요하면 M2 에서 hash 쓰기 추가 |
| 8 | **곱셈/나눗셈 미지원** | 예정됨 | M1 은 add/sub 만. mul/div·X-다이어그램은 M4. Step/Grid 타입은 확장 가능하게 설계(`reveal` 다중 셀, 부분곱 행 확장점) |
