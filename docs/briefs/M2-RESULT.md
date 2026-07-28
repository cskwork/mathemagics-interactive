# M2 결과 — 레슨 프레임워크 + 제1장 콘텐츠

구현자: GLM 5.2 · 완료: 2026-07-29 · 브리프: [M2.md](M2.md)
상태: **브리프 §2 전 7 산출물 구현, §3 완료 기준(명령 3종 + 단위테스트 + 접근성 구조) 통과**.
preview 의 **대화형 브라우저 조작(레슨 완주 클릭·ko/en 전환 실측)**만 이 환경 한계로 미검증(§4.4 솔직 명시).

---

## 1. 한 줄 요약

M1 계산 코어 위에 5단계 레슨(hook→example→fading→practice→done) 상태머신·3단 힌트 사다리·전략 카드·
페이딩을 얹고, 제1장 3레슨(좌→우 덧셈·뺄셈·보수)을 실제 플레이 가능하게 했다. 상태 전이·힌트·잠금·페이딩은
전부 순수 함수로 분리해 **51개 신규 단위테스트**(기존 80 유지 → **131 통과**), check 0오류 0경고, **런타임 의존성 0 추가**.

---

## 2. 결정 사항과 근거

### 2.1 콘텐츠 스키마 — ProblemSet(시드+생성파라미터)로 하드코딩 제거 (산출물 1·5)

`LessonFile`(`content/lessons/*.json`)의 모든 문제는 `{op, method, digits, carry, count, seed}` `ProblemSet` 으로 정의하고,
로더(`buildLesson`)가 M1 생성기 `generateProblems(seed, opts, count)` 로 구체적 `Problem[]` 으로 펼친다(브리프 §2-5).
**피연산자 하드코딩 0건** — 시드만 고정하면 결정적 재현. 텍스트 필드(title/subtitle/rule/intro/hints/strategy)는 전부
`{ko, en}` `LocalizedText`(ko 폴백 — content/localized.ts). 스키마 검증은 **직접 작성한 타입가드**(`isLessonFile`).
**zod 미도입 사유**: 의존성 0 정책(M0~M1) 유지 + 검증 범위가 좁아 타입가드로 충분(zod는 약 45KB 런타임).

### 2.2 상태머신 — 순수 리듀서 `(state, event, counts) → state` (산출물 2)

`src/lib/lesson/state-machine.ts`. 전이를 컴포넌트에서 분리(브리프 §2-2 요구). `LessonEvent` 는 판별 합합:
`skip-hook | next | solved-correct | bottom-out | hint | strategy | review-accepted | review-dismissed`.
- `next` 는 hook→example→fading→practice 단계를 문제 수(counts) 기준으로 자동 전환. **practice 에서 `next` 는 무시** —
  문제를 풀어야(solved-correct/bottom-out) 넘어감(의도적).
- 별 산정: 3★(100%·bottom-out 0) / 2★(≥통과정확도·bottom-out 0) / 1★(완료) / 0★(미완료).
- 잠금 판정 `isLessonUnlocked(prereqs, completedSkillIds)` 도 순수 함수. 1장 사슬: 덧셈→뺄셈→보수(테스트 단언).

### 2.3 3단 힌트 사다리 + 남용 감지 (산출물 3, PLAN §4.1-6 / 리서치 §4.2)

- **Point**(해당 셀 지목): DigitInput 의 활성 셀 링이 이미 지목 역할 + Point 안내 텍스트 말풍선.
- **Teach**(규칙 1줄 + 부분 시연): 규칙 텍스트 + **첫 답 칸을 미리 채움**(새 `prefill` prop 으로 DigitInput 선두 칸 자동 완료).
- **Bottom-out**(답 공개): 답을 크게 보여주고 continue 시 `bottom-out` 전파(정답 불카운트, 시도++).
- 에스컬레이션: `nextHintTier(usedThisProblem)` 가 point→teach→bottom-out 순으로 다음 티어 반환(순수 함수, 테스트).
- **남용 감지**: 연속 bottom-out ≥ `BOTTOM_OUT_ABUSE_THRESHOLD(=2)` → `suggestReview=true` → "예제 다시 볼까요?"
  권유. 수락 시 example 로 복귀(카운터 리셋), 거부 시 practice 유지. 정답 시 consecutive 카운터 0 리셋.
- 힌트 사용은 누적(`hintsUsed`)·bottom-out 횟수(`bottomOuts`)로 progress 에 기록.

### 2.4 페이딩 — `expect` 셀 점진 확대 (PLAN §4.1-5)

순수 함수 `withExpectOnLastK(steps, k)` 가 파생 Step[] 의 write(expect) 스텝 중 **마지막 k 개**만 학생 입력으로 두고,
앞의 write 는 `expect` 를 떼어 자동 공개(DigitInput frontier 가 채운 데모로 보임)한다. k 는 문제 인덱스에 따라
`fadingKForProblem(i, total)` = `min(total, 1+i)` 로 점진 확대(첫 문제 1칸, 그다음 2칸…). "마지막 스텝부터 채운다"
= ltr 에서 가장 나중에 쓰는(가장 오른쪽 자리) 답 칸부터. 원본 steps 불변(새 배열).

### 2.5 M7 토큰·컴포넌트 재사용 — inline 색/폰트 0 (규약 준수)

LessonPlayer·Lessons·Lesson 전부 `var(--*)` 토큰만 사용(`--spotlight`/`--stage-*`/`--applause`/`--house-*`/`--font-*`).
StageDeck 배경 `var(--stage-spotlight-bg)` 로 Playground 와 동일 무대 톤. 버튼은 `btn--primary/secondary/ghost`.
**M7 컴포넌트 재사용**: ColumnGrid(그리드)·StepPlayer(훅/예제 재생)·DigitInput(페이딩/연습 입력)·Dialog 규약.
정답 보상은 DigitInput 의 spotlight-sweep(M7) 그대로. **StepPlayer/DigitInput 에 후진 호환 선택 prop 추가만**
(autoplay/oncomplete/prefill) — 기존 Playground 동작 회귀 0.

### 2.6 전략 카드 — 기록만 (산출물 4, PLAN §4.2-10)

정답 후 "나는 이렇게 풀었어" 3카드(해당 기법/다른 기법/그냥 알았어) + 건너뛰기. 선택을 `strategyCounts` 에 기록.
**분석은 M3**(브리프 명시). 자기 설명(self-explanation)의 저비용 구현.

### 2.7 저작권 안전 콘텐츠 저작 (PLAN §10-1)

title/subtitle/rule/intro/hint/strategy 문장은 **전부 자체 저작** — 원서 문장 0건 복제. 규칙만 가져오고
문장은 새로 썼다(예 "더하는 수를 자리별로 쪼개, 큰 덩어리부터 순서대로 더합니다"). 엔진 파생 narration(derive.ts)도
책 문장이 아닌 규칙 기반 자동 생성문. 예제 수치는 생성기가 새로 만듦(시드).

---

## 3. 추가한 의존성

**없음.** 클라이언트 런타임 의존성은 M0~M1 과 동일(`dexie` 단 1개). 번들 189.88→**220.49KB**(gzip 64.93→**73.89KB**,
+9KB) · CSS 18.09→**21.50KB**(gzip 4.16→**4.64KB**, +0.5KB). 증가분은 전부 새 레슨 프레임워크 코드이며 외부 패키지 0개.

---

## 4. 완료 기준 검증

### 4.1 명령 3종 — 전부 통과 (출력 원문)

```
########## CHECK ##########
$ npm run check
> paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide --strategy baseLocale
ℹ [paraglide-js] Compiling inlang project ...
✔ [paraglide-js] Successfully compiled inlang project.
Loading svelte-check in workspace: /Users/danny/Documents/PARA/Resource/mathemagics-interactive
Getting Svelte diagnostics...
svelte-check found 0 errors and 0 warnings

########## TEST ##########
$ npm test
 RUN  v4.1.10 /Users/danny/Documents/PARA/Resource/mathemagics-interactive
 Test Files  11 passed (11)
      Tests  131 passed (131)
   Start at  06:10:12
   Duration  626ms (transform 1.29s, setup 417ms, import 1.58s, tests 152ms, environment 0ms)

########## BUILD ##########
$ npm run build
vite v8.1.5 building client environment for production...
✔ [paraglide-js] Compilation complete (message-modules)
✓ 295 modules transformed.
dist/registerSW.js                0.18 kB
dist/manifest.webmanifest         0.62 kB
dist/index.html                   1.41 kB │ gzip:  0.79 kB
dist/assets/index-CS7KSPdz.css   21.50 kB │ gzip:  4.64 kB
dist/assets/index-BNaXSzSO.js   220.49 kB │ gzip: 73.89 kB
✓ built in 695ms
PWA v1.3.0  mode generateSW  precache 12 entries (248.86 KiB)
```

### 4.2 테스트 131개 (11파일) — M2 신규 51개 + 기존 80개(회귀 0)

**M2 신규:**
- `src/lib/lesson/state-machine.test.ts` (24) — 5단계 전이(hook→…→done) · skip-hook 범위가드 · practice 'next' 무시 ·
  solved-correct/bottom-out 카운트·진행 · hint 누적 · **남용감지(임계 2)·review-수락/거부** · 전략 카드 기록 ·
  nextHintTier 에스컬레이션 · isLessonUnlocked(1장 사슬) · starsFor/accuracy(3/2/1/0★).
- `src/lib/lesson/loader.test.ts` (19) — 스키마 검증(유효 통과·비객체/잘못된 스칼라/ko누락/en비문자/bad op·method·digits/
  passAccuracy 범위/autoPlayMs/hint·strategy 누락 거부) · ProblemSet 전개(개수·시드 결정성·carry 보장) ·
  loadLessonFromRaw throw · **locale ko 폴백(en 누락→ko)**.
- `src/lib/lesson/fading.test.ts` (8) — expectCount · withExpectOnLastK(마지막 K만 expect·나머지 자동공개·K≥전체·K=0·불변) ·
  fadingKForProblem(점진·상한).

**기존 변경:** `src/lib/router/hash-router.test.ts` — lessons/lesson 라우트 매핑 + 쿼리 무시 케이스 추가(5→5 유지).

**기존 80개(변경 없음, 회귀 0):** derive(43) · aria(5) · dexie-adapter(8) · storage/index(8) · migrations(3) ·
content/localized(2) · ui/parent-gate(6) · hash-router(5).

> LessonPlayer/Lessons/Lesson(.svelte) 의 DOM 동작 자체는 vitest 가 `environment:'node'`(DOM/jsdom 없음 — M0 설계)라
> 단위테스트 불가. 검증 가능한 순수 로직(상태머신·로더·페이딩·잠금)만 떼어 테스트했고, DOM/흐름은 코드 검토 + 정적 서빙 검증(§4.4).

### 4.3 접근성(브리프 §3) — 코드 수준

- 단계 전환 `aria-live="polite"` phase-tag(화면 전환 안내). 힌트 말풍선 `role="status" aria-live="polite"`.
- 힌트 버튼 라벨은 단계별로 변화(힌트/힌트 더 보기/답 보기). 터치 타깃 `var(--tap)`=48px 전역. 본문 `--text-body`=16px.
- `prefers-reduced-motion`: 전역 블록이 즉시 전환(app.css). StageDeck 스포트라이트 배경 reduced-motion 시 제거.
- VoiceOver/NVDA 실측은 여전히 미검증(§4.4).

### 4.4 preview 검증 — 정적 서빙 검증 + 대화형 부분은 미검증 (솔직 명시)

`npm run build && npx vite preview --port 4173` 로 정적 서빙과 번들 포함을 검증했다:

| 확인 항목 | 결과 |
|---|---|
| base 리다이렉트 | `GET /` → 302 → `/mathemagics-interactive/` |
| 앱 HTML | 200 `text/html` 1418B |
| JS 번들 | 200 `text/javascript` 220498B |
| **#/lessons·#/lesson 라우트 번들 포함** | JS 에 `"\/lessons"`, `"\/lesson"` 해시 경로 확인됨 |
| **1장 3레슨 콘텐츠 번들 포함(glob 로드)** | 번들에 레슨 객체 3개(chapter:1 order:1/2/3) + `prerequisites`(잠금 사슬) + `autoPlayMs` + 자체 저작 rule 문장("큰 덩어리부터 순서대로 더") 확인 |
| 전략 선택지 번들 포함 | `this-technique`/`other-technique`/`just-knew` 확인 |
| i18n 키 패리티 | ko/en 각 135키(98 기존 + 37 신규), diff 없음. 기존 키 삭제/변경 0. |

**미검증(브리프 §3 요구, 솔직 명시)**: 브리프가 요구한 **대화형 브라우저 조작** —
"새 프로필로 3레슨 연속 완주(훅부터 완료까지) · 새로고침 후 진도 유지 · ko/en 양쪽에서 레슨 1개 완주" — 을
이 구현 환경에서 직접 클릭하며 확인하지 못했다. 브라우저 자동화 도구(puppeteer/playwright)가 없고 새 의존성 추가 없이는 불가.
상태머신·힌트·잠금·페이딩 정확성은 **51개 단위테스트**로, 렌더·전환 흐름은 코드 검토 + 정적 서빙 검증으로 대체했다.
오케스트레이터가 브라우저에서 `#/lessons` → 레슨 카드 → 훅 자동재생 → 예제 → 페이딩(마지막 칸 채우기) →
연습(정답 시 전략 카드·힌트 3단·bottom-out 남용 시 복귀 권유) → 완료(별·정확도) → 새로고침 후 목록 완료 표시 를 직접 확인해야 한다.

---

## 5. 파일 트리 (git 추적 기준, 신규·변경)

```
content/lessons/                         # ← 신규: 제1장 3레슨 콘텐츠
  ch1-ltr-addition.json
  ch1-ltr-subtraction.json
  ch1-complement-subtraction.json
messages/
  ko.json                                # M2 신규 UI 문자열 37키 추가 (변경)
  en.json
src/
  App.svelte                             # lessons/lesson 라우트 분기 + 가드 (변경)
  routes/
    Lessons.svelte                       # ← 신규: #/lessons 목록(잠금·완료 표시)
    Lesson.svelte                        # ← 신규: #/lesson?id= 플레이어 라우트
    Home.svelte                          # 공연 시작 CTA 활성화→lessons (변경, M7 #5 폐쇄)
  components/
    StepPlayer.svelte                    # autoplay/oncomplete 선택 prop 추가 (변경, 후진호환)
    DigitInput.svelte                    # prefill/oncomplete 선택 prop 추가 (변경, 후진호환)
  lib/
    lesson/                              # ← 신규: 레슨 프레임워크
      types.ts                           # LessonFile/Lesson/ProblemSet/HintLadder/StrategyChoice
      state-machine.ts                   # 순수 리듀서 reduce + 힌트/남용/잠금/별
      state-machine.test.ts              # 24 테스트
      loader.ts                          # 타입가드 검증 + glob 로드 + buildLesson
      loader.test.ts                     # 19 테스트
      fading.ts                          # withExpectOnLastK 페이딩 변환
      fading.test.ts                     # 8 테스트
      LessonPlayer.svelte                # 5단계 플레이어(힌트 사다리·전략카드·남용감지)
    router/
      hash-router.svelte.ts              # lessons/lesson 라우트 추가 (변경)
      hash-router.test.ts                # lessons/lesson 케이스 추가 (변경)
    storage/
      types.ts                           # ProgressRecord M2 확장(optional 5필드) (변경)
    profiles/
      app-state.svelte.ts                # loadAllProgress/loadProgress/saveProgress/activeProfileId (변경)
docs/briefs/M2-RESULT.md                 # 이 문서
```

생성물 `src/lib/paraglide/` 는 gitignore(M0~M7 과 동일). `mathemagics.pdf` 미접근(`git ls-files | grep pdf` → 0건).

---

## 6. 커밋 (로컬, push 안 함)

```
e1412cf feat(lesson): content schema + loader + 5-step state machine + fading (pure logic + tests)
f120799 feat(lesson): LessonPlayer 5단계 + 3단 힌트 사다리 + 전략 카드 (M2)
2679c9c feat(lesson): #/lessons 목록 + #/lesson 플레이어 라우트 + 진도 영속 (M2)
(+ 이 문서 커밋)
```
`git status -sb` → `## main...origin/main [ahead 10]`(이전 7 + M2 3). **push 안 함**(브리프 §4 규약).

---

## 7. 미해결 이슈 / 다음 마일스톤(M3) 인계 사항

| # | 항목 | 심각도 | 비고 |
|---|---|---|---|
| 1 | **대화형 preview 미검증** | 중 | §4.4. 오케스트레이터가 브라우저에서 3레슨 완주·진도 영속·ko/en 전환을 직접 확인. 상태머신·힌트·잠금·페이딩 정확성은 51 단위테스트로 보장 |
| 2 | **정확도 게이트(90%)가 레슨 완료를 막지 않음** | 중(설계) | PLAN §4.1-3의 "정확도 우선 게이트"는 시간 모드 해금(M3) 용. M2는 연습 세트를 다 풀면 완료(별 산정에만 정확도 반영). 미통과 시 재시도/강등 로직은 M3 적응 난이도와 함께 |
| 3 | **전략 카드 분석 미구현** | 예정됨 | 선택 기록만 저장(M3 에서 패턴 분석·보호자 리포트). |
| 4 | **Bottom-out 시 정답이 숫자로만 표시** | 낮음 | 답을 `a op b = answer` 텍스트로 공개. 풀이 과정(스텝) 그리드로 보여주려면 StepPlayer 에 "끝 상태로 정지" prop 필요 — M2 범위 밖, 답 공개 목적은 달성 |
| 5 | **스크린리더 실측 미수행** | 중 | M0 인계 #10 계속. 단계 전환 aria-live·힌트 라벨·포커스 링은 코드 수준. VoiceOver/NVDA 실측은 별도 환경 |
| 6 | **LessonPlayer 가 한 파일에 5단계 전부** | 낮음 | 단계별 하위 컴포넌트 분리(PhaseHook/PhaseExample/…)는 콘텐츠 확장(M4+) 시 고려. 지금은 한 곳에서 단계 전환 흐름이 잘 보임 |
| 7 | **레슨 재개(이어하기) 미구현** | 낮음 | 진입 시 항상 hook 부터 새로 시작(완료 표시는 영속). lessonStepReached 는 저장하므로 M3 에서 이어하기 UI 추가 가능 |
| 8 | **점진 노출(fading)이 항상 마지막 k 칸** | 낮음 | ltr 에선 가장 오른쪽 자리. CRA 페이드(자릿수 다이어그램→암산)는 M4 시각 자산과 함께. 엔진 정확 |
```
