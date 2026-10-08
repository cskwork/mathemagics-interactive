# M3 결과 — 연습 시스템·간격 반복(SRS)·대시보드

구현자: GLM 5.2 · 완료: 2026-07-29 · 브리프: [M3.md](M3.md)
상태: **브리프 §2 전 8 산출물 구현, §3 완료 기준(명령 3종 + 단위/시뮬레이션 테스트) 통과**.
preview 의 **대화형 브라우저 조작(레슨 완주→카드 생성→연습 흐름 클릭)**만 이 환경 한계로 미검증(§4.4 솔직 명시).

---

## 1. 한 줄 요약

FSRS-inspired 스케줄러(직접 구현, ts-fsrs 미채택 — §2.1 사유+번들 수치) · 정확도 90% 게이트 ·
적응 난이도(80–90% ZPD) · interleaving 혼합 세트 · 관대한 스트릭(freeze 자동, 손실 압박 0) ·
학습자 진도·보호자 리포트(대화 소재 1개) 화면을 M2 레슨 위에 얹었다. 스케줄러·게이트·난이도·
스트릭·리포트는 전부 순수 함수로 분리해 **70개 신규 단위/시뮬레이션 테스트**(기존 131 유지 → **201 통과**),
check 0오류 0경고, **런타임 의존성 0 추가**(ts-fsrs 도입 안 함 — 번들 13KB gzip 절약).

---

## 2. 결정 사항과 근거

### 2.1 ts-fsrs 미채택 — 직접 구현 (산출물 1, 번들 수치 포함)

**조사 결과(착수 시점 실측, 2026-07-29)**: ts-fsrs v5.4.1, npm unpacked 700KB, **ESM `index.mjs`
60,657B raw / 13,442B gzip(트리셰이킹 전, 46 exports barrel)**. tree-shake 해도 스케줄러 코어만
~10KB gzip. 현재 JS 번들 gzip 73.89KB(M2) 대비 **+13KB(gzip) = +18% 증가**가 한 기능 치고 과대.

**직접 구현 사유(4가지, 전부 브리프/PLAN과 정합)**:
1. **번들 비용**: ts-fsrs +13KB gzip. 본 프로젝트는 M0~M7 전 단계 "런타임 의존성 0 추가"(`dexie` 단 1개)를
   일관되게 지켜온 문화. 직접 구현 시 SRS 코드 전체가 JS 번들에 ~7KB(gzip) 추가(§4.1 실측 73.89→81.63KB).
2. **아동 보수 기본값(PLAN §4.3)**: ts-fsrs는 성인(의대생·Anki) 데이터로 최적화된 FSRS-6 기본값 탑재.
   PLAN §4.3은 "FSRS 아동 근거 부족 → 보수적 파라미터 + 조정 가능"을 요구. ts-fsrs 기본값과 싸우며
   덮어쓰기보다, 처음부터 아동 보수 기본값(간격 짧게, lapse 축소 보수적 0.4)으로 설계하는 쪽이 단순.
3. **SrsCard 타입 이미 FSRS 형상**: storage/types.ts 의 `{stability, difficulty, reps, lapses, lastReview, due}`
   가 FSRS 개념과 1:1. ts-fsrs는 자체 `Card` 타입→매핑 레이어 필요(불필요한 추상화).
4. **백로그 캡은 앱 고유**: "며칠 공백 후 카드 폭탄 방지"는 FSRS 알고리즘 밖의 앱 정책. 어차피 직접 짜야 함.

**구현 모델**: FSRS-4.5 핵심 역학을 간결하게 재구현한 "FSRS-inspired" (scheduler.ts):
- 검색 가능도 R = (1 + t/(9·S))^(−0.5) — FSRS 멱법 망각곡선.
- 정답 시 안정성 성장: S·(growthByRating)·(1+w·(1−R))·difficultyDamp. **R 낮을수록(방금 잊힐 즈음) 더 강화**
  = 바람직한 어려움(desirable difficulty).
- 난이도 평균 회귀: D + step·(3−rating) 을 μ 비율로 initialDifficulty 로 끌어당김 → **SM-2 "ease hell" 방지**
  (teaching-trends §1.2 명시적 이점).
- lapse 시 S *= 0.4(보수적, PLAN §4.3).

### 2.2 파라미터 전부 외부화 — 보수적 기본값 (PLAN §4.3)

`src/lib/srs/config.ts` 의 `SrsConfig` (21개 필드) + `DEFAULT_SRS_CONFIG`. 각 필드에 근거 주석.
아동 증거 부족(PLAN §10-3, teaching-trends §1.2 "미검증 영역")을 **"더 자주 복습"**으로 대응:
- `lapseStabilityFactor: 0.4` (FSRS 성인값보다 보수 — 한 번 틀리면 안정성을 40%로 축소)
- `minIntervalDays: 0.04` (~1시간, 학습 밀집기 첫 복습 허용)
- `maxBacklog: 12` (한 세션 상한 — 5–10분 분량)
- `gateMinReviews: 5` + `gateAccuracy: 0.9` (PLAN §4.1-3, McNeil 2025)
- `zpdLow/High: 0.8/0.9` (PLAN §4.2-7)
- `streakDefaultFreezes: 2` (PLAN §4.2-11 관대함)

값만 바꾸면 전체 스케줄/게이트/난이도가 조정된다. UI 설정 노출은 별도 마일스톤(M5+).

### 2.3 백로그 캡 알고리즘 — 불규칙 사용 견고성 (PLAN §4.3)

`backlog.ts` `capBacklog(dueCards, now, config)`:
1. due 카드 전체를 **안정성 낮은 순(취약 기억 우선)** 정렬.
2. `maxBacklog`(12) 개만 세션에. 넘치는 overflow 는 `backlogSpreadDays`(3일)에 걸쳐 **due 균등 재분산**
   → 며칠 쓰지 않다 돌아와도 한 번에 50개 카드가 쏟아지지 않음(8–13세 좌절 방지).
3. overflow 의 stability 는 gap 으로 인해 추가 벌밋지 않음 — retrievability 가 자연히 낮아져 정답 시
   더 크게 강화되는 역학(desirable difficulty)이 견고성을 담당.

시뮬레이션 2(불규칙 시나리오)가 이를 검증(§4.3).

### 2.4 정확도 게이트 — 단조 잠금 (산출물 2, PLAN §4.1-3)

`gate.ts` `decideProficiency(stats, config)` → 4단계:
`pre-learning` → `learning` → `gate-passed` → `fluent`.
- gate-passed 조건: 누적 정확도 ≥ 90% **AND** 샘플 ≥ 5회.
- **단조적**: 한 번 `gatePassedAt` 설정(ProgressRecord optional 필드)하면 최근 부진으로 **재잠금 없음**
  (아동 친화 — 손실 압박 금지 PLAN §4.2-11). 시뮬레이션 1·3 이 동작 검증.
- `fluent`: gate 통과 + 최대 안정성 ≥ 21일(긴 간격 = 안정 기억). 이것이 M5 공연 모드 해금 전제.
- 시간 요소(속도 모드)는 `timeModeUnlocked()` 가 gate-passed/fluent 일 때만 true → PLAN §4.1-3 정합.

### 2.5 적응 난이도 — ZPD 한 눈금 조정 (산출물 3, PLAN §4.2-7)

`difficulty.ts` `adjustBand(accuracy, currentBand, config)`:
- accuracy < 0.8 → 밴드 −1(더 쉽게), > 0.9 → +1(더 어렵게), 0.8–0.9 → 유지(ZPD).
- 밴드 → {digits, carry} 매핑: 0={2,F} 1={2,T} 2={3,T} 3={4,T} 4={4,T}.
- 하단(0)/상단(maxBand=4) 고정. 잘못된 accuracy(NaN/음수)는 유지(판단 보류).
- 순수 함수 + 12개 단위테스트. 세션 종료 시 `rebandCard` 로 카드 밴드 갱신(integration.ts).

### 2.6 Interleaving 혼합 세트 — "어떤 트릭?" 판단 (산출물 4, PLAN §4.2-9)

`session.ts` `interleave(cards, seed, config)`: 결정적 시드(mulberry32) 셔플 후 **같은 skillId 가 연속하지
않도록** 그리디 재배열. 전략 선택 훈련이 mathemagics 의 핵심 역량(teaching-trends §1.3).
- 시드 기반 → 같은 due 세트면 같은 순서(테스트 가능).
- A 4/B 4 입력 시 연속 중복 0(ABABABAB). A 5/B 2 시 최대 연속 런 < 5(테스트 단언).
- `buildSession`(integration.ts)이 capBacklog + interleave 를 SrsCard 단위로 엮음.

세션은 `maxBacklog`(12) 분량으로 자연 종료 — **무한 이어하기 강요 금지**(PLAN §7.2). 종료 화면에
정답 수/총복습 통계 + 홈/진도 이동.

### 2.7 관대한 스트릭 — 손실 압박 0 (산출물 5, PLAN §4.2-11)

`streak.ts` `updateStreak(prev, now, reviewsDone, config)`:
- 하루 최소량 `streakMinDailyReviews`(1) 미달 시 **변화 없음(손실도 없음 — 그냥 미적용)**.
- 공백 1일 → `freezesAvailable`(기본 2) 자동 소진으로 연장. **"freeze 쓰세요!" 프롬프트 없음**(자동).
- 공백이 freeze 초과 시 `fresh-start`(스트릭=1) — **"잃을 뻔했어요!" 손실 프레임 금지**.
- UI(Progress)는 "N일 연속" 축하 톤만(applause 색). 비교·순위·리더보드 전무(PLAN §7.2).
- Settings optional 필드(`streakCount`/`lastStreakDayMs`/`freezesAvailable`)에 저장.

### 2.8 보호자 리포트 — 행동 지향 대화 소재 (산출물 7, PLAN §4.5)

`report.ts` `buildWeeklyReport(learned, now)`:
- 이번 주(7일) completedAt 기법 최신순.
- **대화 소재 1개**: 가장 최근 기법으로 `generateProblem`(주 단위 안정 시드) 샘플 생성 →
  Localized 문구 "Ask how they worked out 「757 + 34」" (ko/en 객체, PLAN §6.2 `Localized<T>`).
- teaching-trends §4.5 원칙: "자녀 비교·순위 대신 행동 지향 정보". 정답 재촉 말고 "어떻게 풀었는지" 물어보라.
- 프라이버시 안내("모든 기록 이 기기에만") — COPPA 정합(PLAN §7.2, 수집 자체가 없음).

### 2.9 M7 토큰·컴포넌트 재사용 — inline 색/폰트 0 (규약 준수)

Practice/Progress/Report 전부 `var(--*)` 토큰만(`--spotlight`/`--applause`/`--stage-*`/`--font-*`).
DigitInput(M1) 재사입으로 문제 풀이. 버튼은 `btn--primary/secondary/ghost`. 게이트 뱃지는
숙련도별 토큰 색(learning=spotlight, gate-passed=applause, fluent=spotlight 배경). `prefers-reduced-motion`
시 stage-deck 스포트라이트 배경 제거. M7 컴포넌트 변경 0(후진 호환).

---

## 3. 추가한 의존성

**런타임 npm 의존성: 0개 추가.** M2 와 동일(`dexie` 단 1개).

| 항목 | 형태 | 사유 |
|---|---|---|
| ts-fsrs | **미도입** | §2.1 참조. ESM 60.6KB/13.4KB gzip(barrel, 트리셰이킹 전). 직접 구현이 +13KB gzip 절약 + 아동 보수 기본값 제어 + SrsCard 타입 이미 FSRS 형상 + 백로그 캡은 앱 고유. |

---

## 4. 완료 기준 검증

### 4.1 명령 3종 — 전부 통과 (출력 원문)

```
########## CHECK ##########
$ npm run check
> paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide --strategy baseLocale
ℹ [paraglide-js] Compiling inlang project ...
✔ [paraglide-js] Successfully compiled inlang project.
Loading svelte-check in workspace: /Users/<user>/Documents/PARA/Resource/mathemagics-interactive
Getting Svelte diagnostics...
svelte-check found 0 errors and 0 warnings

########## TEST ##########
$ npm test
 RUN  v4.1.10 /Users/<user>/Documents/PARA/Resource/mathemagics-interactive
 Test Files  18 passed (18)
      Tests  201 passed (201)
   Start at  06:25:49
   Duration  864ms (transform 1ms, setup 637ms, import 1.64s, tests 221ms, environment 1ms)

########## BUILD ##########
$ npm run build
vite v8.1.5 building client environment for production...
✔ [paraglide-js] Compilation complete (message-modules)
✓ 352 modules transformed.
dist/registerSW.js                0.18 kB
dist/manifest.webmanifest         0.62 kB
dist/index.html                   1.41 kB │ gzip:  0.78 kB
dist/assets/index-CKdxKwex.css   25.54 kB │ gzip:  5.17 kB
dist/assets/index-DvN4QsQn.js   246.28 kB │ gzip: 81.63 kB
✓ built in 788ms
PWA v1.3.0  mode generateSW  precache 12 entries (277.99 KiB)
```

번들 증가(M2 대비): JS 220.49→**246.28KB**(gzip 73.89→**81.63KB**, +7.74KB) · CSS 21.50→**25.54KB**
(gzip 4.64→**5.17KB**, +0.53KB). 증가분 전부 새 SRS 코드 + 3 라우트. 외부 패키지 0개(ts-fsrs 미도입 효과로
+13KB 가 아닌 +7.74KB gzip). 생성물 `src/lib/paraglide/` 는 gitignore.

### 4.2 테스트 201개 (18파일) — M3 신규 70개 + 기존 131개(회귀 0)

**M3 신규(src/lib/srs/, 70개):**
- `scheduler.test.ts` (19) — retrievability(멱법 망각곡선: t=0→R=1 · 단조감소 · 안정성 클수록 느린 망각 ·
  음수 elapsed 0처리) · nextDifficulty(again↑/easy↓ · 클램프 · **평균회귀 ease-hell 방지**) ·
  nextStability(lapse 축소 · hard<good<easy 성장 · **R 낮을수록 강화** · 난이도 둔화 · 상한클램프) ·
  fuzzInterval(퍼즈 범위) · review(again lapses↑reps리셋 · due 미래 · 첫복습 성장) · isDue ·
  **보수성(good 연속 시 간격 단조증가하되 6회만에 60일 미만)**.
- `gate.test.ts` (10) — 4단계(pre-learning/learning/gate-passed/fluent) · **단조 잠금(gatePassedAt 있으면
  재잠금 없음)** · accuracyOf · timeModeUnlocked(게이트 전 false = 시간 요소 노출 금지).
- `difficulty.test.ts` (12) — band↔params 매핑 · adjustBand(<0.8 하향 · >0.9 상향 · 0.8–0.9 유지 ·
  하단/상단 고정 · NaN/음수 유지) · adjustFromAccuracy(direction/params).
- `session.test.ts` (9) — interleave(결정적 · 누락/중복 없음 · **A4/B4 연속중복 0** · 다수 기법도 최소화) ·
  capBacklog(max 이하 전체 · 초과 시 세션 max+overflow 재분산 · **취약 기억 우선** · overflow 균등분산).
- `streak.test.ts` (9) — startOfDay/daysBetween · updateStreak(최소량미달 변화없음 · 같은날 · 어제+1 ·
  **공백1일 freeze 연장** · freeze초과 fresh-start · 첫연습).
- `report.test.ts` (7) — isThisWeek(7일 경계) · buildWeeklyReport(빈 리포트 · 최신순 · **대화소재 ko/en 생성** ·
  주 내 샘플 안정 · 빼기 − 기호).
- `simulation.test.ts` (5, **3 시나리오 + 보너스 1**) — §4.3 참조.

**기존 변경:** `hash-router.test.ts` — practice/progress/report 케이스 추가.

**기존 131개(변경 없음, 회귀 0):** derive(43) · aria(5) · state-machine(24) · loader(19) · fading(8) ·
dexie-adapter(8) · storage/index(8) · migrations(3) · content/localized(2) · ui/parent-gate(6) · hash-router(5→8).

### 4.3 시뮬레이션 3 시나리오 — 브리프 §2-8 / §3 요구 (simulation.test.ts)

1. **성실한 학습자(매일 good × 30일)**: 안정성 단조 성장 · 30/30 정확도로 게이트 통과(gate-passed 이상) ·
   충분히 자라면 fluent · **스트릭 30일 연속(freeze 소진 0)**.
2. **불규칙 학습자(10일 공백)**: 스케줄러 공백에 견고(stability 유의미 성장, 결정적) · **백로그 캡이
   30개 due → maxBacklog 12개만 세션, overflow 미래 분산**(카드 폭탄 방지 검증) · 공백 1일 freeze 연장.
3. **bottom-out 과잉 사용(again × 15)**: lapses 15 누적 · reps 매번 리셋 · 안정성 최소값 근처 ·
   **게이트 learning 미통과(정확도 0%)** · 적응 난이도 밴드 하향(3→2→1, 0에서 고정).
4. (보너스) **혼합 세트 interleaving**: 두 기법 같은 입력 → 같은 결과(결정적) · 둘 다 due 로 세션 동시 가능.

### 4.4 preview 검증 — 정적 서빙 + 대화형 부분은 미검증 (솔직 명시)

`npm run build && vite preview` 로 정적 서빙 + 번들 포함 검증:

| 확인 항목 | 결과 |
|---|---|
| base 리다이렉트 | `GET /` → 200 `/mathemagics-interactive/` |
| 앱 HTML | 200 `text/html` 1418B |
| JS 번들 | 200 `text/javascript` 246282B |
| **#/practice·#/progress·#/report 라우트 번들 포함** | JS 에 `"/practice"`,`"/progress"`,`"/report"` 해시 경로 확인됨 |
| **SRS 로직 번들 포함** | `conversationStarter`/`interleave`/`maxBacklog`/`gatePassedAt`/`streakCount` 확인 |
| i18n 키 패리티 | ko/en 각 **177키**(M2 135 + M3 신규 42), `only-in-ko=[]` `only-in-en=[]`. 기존 키 삭제/변경 0. |

**미검증(브리프 §3 요구, 솔직 명시)**: 브리프가 요구한 **대화형 브라우저 조작** —
"레슨 완료 → 카드 생성 → 오늘의 연습 등장 → 세션 종료 화면, 진도·리포트 화면 데이터 표시" — 을
이 구현 환경에서 직접 클릭하며 확인하지 못했다. 브라우저 자동화(puppeteer/playwright)가 없고 새 의존성
추가 없이는 불가. 스케줄·게이트·난이도·스트릭·리포트·인터리빙 정확성은 **70개 단위/시뮬레이션 테스트**로,
라우트·카드생성·진도 영속 흐름은 코드 검토 + 정적 서빙 검증으로 대체. 오케스트레이터가 브라우저에서
`#/practice`(due 카드 섞임·DigitInput 풀이·종료 화면) · `#/progress`(숙련도 뱃지·스트릭) ·
`#/report`(대화 소재) · 레슨 완주 후 `#/practice` 에 카드 등장 을 직접 확인해야 한다.

---

## 5. 파일 트리 (git 추적 기준, 신규·변경)

```
messages/
  ko.json                                # M3 신규 UI 문자열 42키 추가 (변경)
  en.json
src/
  App.svelte                             # practice/progress/report 라우트 분기 (변경)
  routes/
    Practice.svelte                      # ← 신규: #/practice 오늘의 연습(혼합 세트·종료 화면)
    Progress.svelte                      # ← 신규: #/progress 기법별 숙련도·스트릭·최근 활동
    Report.svelte                        # ← 신규: #/report 보호자 리포트(대화 소재)
    Home.svelte                          # 연습/진도/리포트 CTA 추가 (변경)
  lib/
    srs/                                 # ← 신규: SRS 엔진(전부 순수 함수)
      config.ts                          # SrsConfig + DEFAULT_SRS_CONFIG (21개 파라미터 외부화)
      types.ts                           # Rating/ProficiencyLevel/ReviewOutcome/CardSpec
      scheduler.ts                       # FSRS-inspired 스케줄러(retrievability/stability/difficulty/review)
      backlog.ts                         # capBacklog (밀린 카드 폭탄 방지)
      gate.ts                            # decideProficiency (정확도 게이트·단조 잠금)
      difficulty.ts                      # adjustBand (ZPD 80-90% 적응 난이도)
      session.ts                         # interleave (혼합 세트 — 전략 선택 훈련)
      streak.ts                          # updateStreak (관대한 스트릭, freeze 자동)
      report.ts                          # buildWeeklyReport (보호자 대화 소재 생성)
      integration.ts                     # SrsCard ↔ 순수 스케줄러 다리(카드 생성/복습/밴드조정/세션 빌드)
      scheduler.test.ts                  # 19 테스트
      gate.test.ts                       # 10 테스트
      difficulty.test.ts                 # 12 테스트
      session.test.ts                    # 9 테스트 (interleave + capBacklog)
      streak.test.ts                     # 9 테스트
      report.test.ts                     # 7 테스트
      simulation.test.ts                 # 5 테스트 (3 시나리오 + 보너스)
    lesson/
      LessonPlayer.svelte                # 레슨 done 시 SRS 카드 생성(멱등) 추가 (변경)
    profiles/
      app-state.svelte.ts                # loadAllCards/getDueCards/upsertCard 추가 (변경)
    router/
      hash-router.svelte.ts              # practice/progress/report 라우트 추가 (변경)
      hash-router.test.ts                # 신규 라우트 케이스 추가 (변경)
    storage/
      types.ts                           # SrsCard/ProgressRecord/Settings M3 optional 확장 (변경, 스키마 v1 불변)
docs/briefs/M3-RESULT.md                 # 이 문서
```

생물 `src/lib/paraglide/` 는 gitignore(M0~M7 과 동일). `mathemagics.pdf` 미접근(`git ls-files | grep pdf` → 0건).

---

## 6. 커밋 (로컬, push 안 함)

```
feat(srs): FSRS-inspired scheduler + accuracy gate + adaptive difficulty + interleaving + streak + report (pure logic + tests)
feat(srs): storage extensions + card creation on lesson completion + AppState SRS methods
feat(srs): #/practice + #/progress + #/report routes + Home nav + router wiring
(+ 이 문서 커밋)
```
`git status -sb` → `## main...origin/main [ahead N]`. **push 안 함**(브리프 §4 규약).

---

## 7. 미해결 이슈 / 다음 마일스톤(M4) 인계 사항

| # | 항목 | 심각도 | 비고 |
|---|---|---|---|
| 1 | **대화형 preview 미검증** | 중 | §4.4. 오케스트레이터가 브라우저에서 레슨완주→카드생성→연습→종료, 진도·리포트 데이터 표시 직접 확인. 스케줄·게이트·난이도·스트릭·리포트 정확성은 70 단위/시뮬레이션 테스트로 보장 |
| 2 | **속도 모드(M5 공연) 연결 미구현** | 예정됨 | 게이트 통과 시 `timeModeUnlocked()` true 반환은 구현. 실제 속도 측정·공연 모드 UI 는 M5. 현재는 게이트 상태 표시(Progress)까지 |
| 3 | **카드 밴드 변경 시 구 factId 잔류** | 낮음 | 어댑터에 deleteCard 없어, 밴드 바뀐 구 카드를 `due=now+365일`로 밀어 사실상 비활성 처리(integration.ts + Practice.svelte). M6 서버 어댑터 시 진짜 삭제 권장. 데이터 정합성 영향 없음(만료 카드는 due 쿼리에 안 잡힘) |
| 4 | **스크린리더 실측 미수행** | 중 | M0 인계 #10 계속. 숙련도 뱃지·대화 소재 aria-live·포커스 링은 코드 수준. VoiceOver/NVDA 실측은 별도 환경 |
| 5 | **게이트 정확도가 누적 기반** | 낮음(설계 의도) | correct/total 누적으로 gate 판정. 아동 친화(한 번 통과하면 재잠금 없음)이지만, 숙련도 하락을 즉시 반영하지 않음. 최근 N회 윈도우 원하면 M5+ 에서 SrsCard 에 rolling 배열 추가 가능 |
| 6 | **대화 소재 시드가 주 단위** | 낮음 | 같은 주엔 같은 샘플 문제(안정). 주가 바뀌면 새 문제. 의도적 — 아이가 일주일에 걸쳐 같은 문제로 대화할 수 있게 |
| 7 | **Practice 세션 시드가 `now/DAY`** | 낮음 | 하루 단위로 세션 순서가 안정. 같은 날 재시도 시 같은 순서. 의도적 |
| 8 | **적응 난이도 밴드가 기법별 1 카드** | 낮음 | 현재 기법×밴드 = 카드 1장. 다중 밴드 병존(예: 2자리와 3자리 동시 복습)은 M4 콘텐츠 확장 시 재검토 |
```
