# M6 결과 — 기억술(로케일별) · 고급 곱셈(제8장) · 셀프호스트 서버

구현자: GLM 5.2 · 완료: 2026-07-29 · 브리프: [M6.md](M6.md)
상태: **브리프 §2 전 5 산출물 구현, §3 완료 기준(명령 3종 + 기억/8장 엔진 테스트 + 왕복 이식) 통과**.
대화형 브라우저 preview 만 이 환경 한계로 미검증(§4 솔직 명시). **Bun 사용 가능 — 서버 실구동 + 왕복 이식 실검증**.

---

## 1. 한 줄 요약

기억술을 로케일별 별도 모듈(ko=**한글 자음 매핑 신설계**, en=원서 Major System)로 구현하고, 8장 고급 곱셈
엔진(4/5자리 제곱·3×2·3×3·5×5 + 자리올림 선예측 + 메모리 슬롯)과 메모리 슬롯 UI, Bun+Hono+`bun:sqlite`
셀프호스트 서버(`/api/health` 계약 준수), ExportBundle 내보내기/가져오기 UI를 얹어 **PLAN 전체 범위를 닫았다**.
**49개 신규 단위/속성 테스트**(기존 316 유지 → **365 통과**), check 0오류, 런타임 클라이언트 의존성은 `hono`(서버 전용, **번들 0바이트**) 1개 추가.

---

## 2. 결정 사항과 근거

### 2.1 한글 자음 매핑 — 신설계 (PLAN §10-2, 산출물 1)

전체 설계는 [docs/memory-system-ko.md](../memory-system-ko.md) 에 서술했다. 핵심 3결정:

1. **글자(자모) 기반, 음성 아님** — 한글은 글자가 이미 거의 음소 단위라 8~13세에게 "글자를 본다" 규칙이
   원서 Major System(음성 기반)보다 훨씬 쉽다. 영어는 철자가 불규칙해 반드시 음성이어야 하지만 한글은 아니다.
2. **조음 계급 충돌 0** — 평/경/거센 triple({ㄱㅋㄲ} …)에서 **최대 1종만** 골라 비슷한 소리가 다른 숫자로
   가는 혼동을 원천 차단. 5 triple × 1종 + 5 단일자음(ㄴ ㄹ ㅁ ㅇ ㅎ) = 정확히 10종. 이것이 "혼동 최소화"의 답.
3. **단어→숫자 결정적·유일** — 초성·종성 자음을 순서대로 읽음. 겹받침은 구성 자음 순서대로 분해(닭→ㄷㄹㄱ→341).

매핑: `ㅇ=0 ㄱ=1 ㄴ=2 ㄷ=3 ㄹ=4 ㅁ=5 ㅂ=6 ㅅ=7 ㅎ=8 ㅈ=9`. 검증 예: 나비→26, 사과→71, 호랑이→8400, 안녕→0220.
**원서 문장·예제 0건 복제** — 규칙·매핑표·단어 사전 모두 자체 설계·저작.

`en` 모듈은 원서 Major System 그대로(0=s/z … 9=p/b, 음성 기반). digraph(ch/sh/ph/ng/qu/th)와 soft/hard c·g, x(=ks) 처리.

### 2.2 메모리 슬롯 UI (산출물 2)

`MemorySlot.svelte` — 계산 중간값을 "단어 카드"(음성 코드 digits)로, 손가락 저장은 ✋ hand 변형으로.
8장 레슨에서 `memory` 스텝(store/recall) 이 발생하면 LessonPlayer 가 카드 랙을 렌더(`techniqueVisual.kind='adv'`).
손가락 변형은 4장 엄지 법칙(book-content-map §4-2) 치환. M7 토큰 전용(`var(--*)`).

### 2.3 8장 고급 곱셈 엔진 + 자리올림 선예측 (산출물 3, book-content-map §8)

`derive-adv.ts` 순수 함수 5기법 + 새 Step 타입 `memory`(store/recall):
- **square-4digit**: A²=(A+d)(A−d)+d² (d=1000단위). **자리올림 선예측 `CarryPrediction`** — d²≤250,000 이므로
  lowPart+d²≥1e6 으로 백만 자리 올림 여부 판정. **이것이 5장 어림이 8장의 부품이 되는 지점**(스킬트리 반영, 2.4).
- **mul-3x2**: b를 (십+일)로 쪼개 a에 두 번 곱해 더함(덧셈법; 분해/인수법은 method 선택).
- **square-5digit**: (a·1000+b)²=a²·10⁶+2ab·10³+b² 3항. **가운데 항(2ab) 먼저** → 메모리 슬롯.
- **mul-3x3**: 근접수법 (z+a)(z+b)=z(z+a+b)+ab.
- **mul-5x5**: (a·1000+b)(c·1000+d) 4분할. 어려운 3×2 두 개 → 슬롯 2개 저장.

모든 결과는 독립 산술(a*a, a*b)과 대조(§4.2). X-다이어그램(M4 `squareDiagram`) 재사용 + memory 스텝 결합.

### 2.4 스킬트리 — 자리올림 선예측이 5장 어림을 선행 요구 (PLAN §3.2)

`ch8-square-4digit`/`ch8-square-5digit` 레슨 JSON 의 `prerequisites` 에 `est-band`(5장 반올림 밴드) 포함.
기존 `isLessonUnlocked`(prerequisites 판정)이 이 의존을 시행 — 자리올림 선예측 기법이 5장 어림 없이 열리지 않는다.
4267²=18,207,289(§8-2 공식 예제)·396×387=153,252(§8-8) 등 book-content-map 예제 수치 대조 통과.

### 2.5 셀프호스트 서버 — Bun + Hono + `bun:sqlite` (산출물 4, architecture-hosting §2b)

`server/index.ts` 단일 파일. 정적 빌드(dist/) 서빙 + REST(StorageAdapter 와 1:1) + `/api/health`.
- **`/api/health` 계약 줸수**(PLAN §6.1, M0 확정): `{"app":"mathemagics","version":"0.0.0"}` 를
  `application/json` 으로 반환 → probe 3조건(status+json+app 마커) 모두 만족. **실측**(§4.4).
- **SQLite 스키마**(`server/schema.ts`) — 4테이블 + 인덱스(`srs_cards` 의 `[profile_id, due]` due 질의용) + meta(schema_version).
  ExportBundle `schemaVersion=1` 과 정합. cascade 삭제·merge(last-write-wins) 구현.
- **RestAdapter 실구현** — M0 의 client 코드는 이미 StorageAdapter 를 HTTP 로 완전 위임하는 완전한 클라이언트였다.
  M6 의 "본 구현" = **서버가 실제로 존재**하게 하는 것. RestAdapter 코드는 무결(경로가 서버와 1:1), 서버가 응답한다(§4.4 실측).

### 2.6 ExportBundle UI — 미리보기 + merge/replace (산출물 5)

`Settings.svelte` 확장. 내보내기(JSON 다운로드) · 가져오기(파일 → `migrate()` 검증 → **미리보기 다이얼로그**:
프로필/진도/카드/설정 개수 표시 → merge/replace 선택 → 적용). `AppState.exportData/importData` 추가.
M7 Dialog 재사용(포커스 트랩·ESC). replace 는 danger 스타일(miss 색).

### 2.7 M7 토큰·컴포넌트 재사용 — inline 색/폰트 0 (규약 준수)

`MemorySlot.svelte`·`Memory.svelte`·`Settings.svelte` 전부 `var(--*)` 토큰. **신규 파일 genuine 색 리터럴 0건**(§4.3 grep 실측).
font-family 도 `var(--font-*)`. `StepPlayer.BASE_MS` 에 `memory:900` 추가(Step 유니온 확장에 따른 Record 필수).

---

## 3. 추가한 의존성 (전부 한 줄 사유)

| 패키지 | 버전 | 형태 | 사유 |
|---|---|---|---|
| `hono` | ^4.12.32 | **dependencies** | 셀프호스트 서버(PLAN §6.1) 라우터. `server/` 전용 — **클라이언트 번들에 0바이트**(§4.3 실측, src/ 에서 import 안 함). bun:sqlite 는 Bun 런타임 내장(npm 패키지 아님) |

클라이언트 런타임 번들 의존성은 여전히 `dexie` 1개만. Bun 자체는 런타임(의존성 아님, 설치 안내는 docs/self-host.md).

---

## 4. 완료 기준 검증

### 4.1 명령 3종 — 전부 EXIT=0 (출력 원문)

```
########## CHECK ##########
> npm run i18n && svelte-check --tsconfig ./tsconfig.json
✔ [paraglide-js] Successfully compiled inlang project.
Loading svelte-check in workspace: /Users/<user>/Documents/PARA/Resource/mathemagics-interactive
Getting Svelte diagnostics...
svelte-check found 0 errors and 0 warnings

########## TEST ##########
 RUN  v4.1.10 /Users/<user>/Documents/PARA/Resource/mathemagics-interactive
 Test Files  28 passed (28)
      Tests  365 passed (365)
   Start at  07:44:54
   Duration  1.10s (transform 1.87s, setup 854ms, import 2.64s, tests 417ms, environment 2ms)

########## BUILD ##########
dist/assets/index-ae7a7f3T.js   387.63 kB │ gzip: 121.10 kB
dist/assets/index-...css         (44.40 kB)
✓ built in 1.02s
PWA v1.3.0  mode generateSW  precache 12 entries (435.81 KiB)
```

번들 증가(M5 대비): JS 344.20→**387.63KB**(gzip 108.65→**121.10KB**, +12.45KB). 증가분 = 기억 엔진·8장 엔진·MemorySlot·Memory/Settings 라우트·5레슨.
**hono 는 번들에 0바이트**(서버 전용 import, §4.3 실측). 기존 316 테스트 회귀 0.

### 4.2 테스트 365개 (28파일) — M6 신규 49개 + 기존 316개(회귀 0)

**M6 신규 기억 엔진(28개):** `src/lib/memory/engine.test.ts` —
- **ko encode**: 나비→26 · 사과→71 · 호랑이→8400 · 곰→15 · 개→1 · 안녕→0220 · 자동차→930(ㅊ 건너뜀) · 닭→341(겹받침 분해) · 비한글 무시 · 결정성 · 수학→781.
- **en Major**: dog→17 · moon→32 · cat→71 · cheese→60 · phone→82 · show→6 · knight→21(묵음 k/gh) · kitten→712(중복 자음 1회) · city→01(soft c) · gym→63(soft g).
- **공통 엔진**: encodeWordToDigits 위임 · verifyWord 왕복 · systemForLocale · findWordsForDigits · **사전 전 항목 encode↔저장값 일치(ko/en)** · 사전 non-empty.

**M6 신규 8장 엔진(21개):** `src/lib/engine/derive-adv.test.ts` —
- square4Layout: 4267²=18,207,289(공식 예제) · d²≤250,000 · **자리올림 선예측 willCarry 정확**.
- mul3x2Layout: 386×51=19,686 · 5시드 a*b 대조.
- square5Layout: 46792² 3항 전개 · 5시드.
- mul3x3Layout: 396×387=153,252 · 107×111=11,877(근접수법 예제).
- mul5x5Layout: 4분할 a*b 대조(5시드).
- **deriveSteps 답칸 = 독립 산술**(5 method) · 4267²·396×387 known 예제.
- **memory 스텝 등장**(store/recall ≥2, 가운데 항 슬롯 저장).

**M6 신규 라우터(+1 단언):** hash-router `#/memory` 매핑.

### 4.3 토큰 잠금 + 의존성 + 저작권 검증 — grep 실측

```
$ rg 'hono' dist/assets/*.js
# (결과 없음, exit=1) ← hono 는 클라이언트 번들에 0바이트(서버 전용).

$ rg '(#[0-9a-fA-F]{6}|oklch\(|rgba?\()' src/components/MemorySlot.svelte src/routes/Memory.svelte src/routes/Settings.svelte
# (결과 없음, exit=1) ← 신규 컴포넌트/라우트 genuine 색 리터럴 0건.

$ rg "font-family:\s*['\"]?[A-Z]" src/components/MemorySlot.svelte src/routes/Memory.svelte
# (결과 없음, exit=1) ← font-family 전부 var(--font-*) 토큰.

i18n 패리티: ko 271키 / en 271키, only-in-ko=[] only-in-en=[](실측).

$ git ls-files | grep -c pdf  →  0   ← mathemagics.pdf 미접근.
```

### 4.4 Bun 가용성 + 서버 실구동 + 왕복 이식 — **실검증** (솔직 명시)

**Bun 1.3.14 설치됨** → 서버·왕복 이식 **실제로 실행·검증**함(미검증 아님).

**`npm run roundtrip`(`bun run server/roundtrip.ts`) — 17단언 전부 통과:**
```
== round-trip: static ExportBundle → server import(replace) → re-export ==
  ✓ app marker preserved · ✓ schemaVersion = 1 · ✓ 2 profiles · ✓ 한글 이름 보존
  ✓ progress/srs/settings 보존 · ✓ round-trip data equal (excluding exportedAt)
== merge mode: older record does not overwrite newer ==
  ✓ merge keeps newer (attempts=10, not 1) · ✓ lastPlayedAt
== delete cascade ==  ✓ 1 profile · ✓ progress/srs cascade-deleted
ALL ROUND-TRIP TESTS PASSED
```

**`npm run server` 실구동 + HTTP 왕복(curl 실측):**
| 확인 항목 | 결과 |
|---|---|
| `/api/health` 계약 | `{"app":"mathemagics","version":"0.0.0"}` · **HTTP 200 application/json** ✓ |
| profile CRUD | PUT→`{"ok":true}` · GET→`[{"id":"p1","name":"하늘",...}]` ✓ |
| settings GET/PUT/404 | PUT ok · GET ok · 미존재 **404** ✓ |
| **HTTP 왕복**(import→export) | import(replace)→ok · export→가져온 데이터 정확히 회수(프로필·설정·한글) ✓ |
| 정적 SPA 서빙 | index.html **HTTP 200 text/html** ✓ |

→ `RestAdapter` client 가 이 서버와 실제로 통신 가능함을 HTTP 수준에서 확인. probe 3조건 모두 만족하므로
브라우저에서 자동 감지→서버 모드 전환됨(M0 probe 계약 준수).

### 4.5 미검증 항목 — 솔직 명시

| 항목 | 상태 | 비고 |
|---|---|---|
| **대화형 브라우저 preview** | 미검증 | 기억술 연습 클릭·8장 레슨 완주·ExportBundle 가져오기 클릭 흐름. 이 환경에 브라우저 자동화 없음. 엔진·왕복은 단위/실구동 테스트로 보장, UI 흐름은 오케스트레이터 브라우저 실측 필요 |
| **Docker 빌드·기동** | **미검증** | 이 환경에 Docker daemon 없음. Dockerfile 은 표준 2단계(노드 빌드→oven/bun 런타임). `docker build -f server/Dockerfile -t mathemagics . && docker run -p 3000:3000 -v mathemagics-data:/data mathemagics` 로 오케스트레이터가 확인 |
| **RestAdapter 브라우저 자동 감지→CRUD** | 미검증(부분) | HTTP 엔드포인트는 curl 로 전부 검증(§4.4). 브라우저에서 probe→RestAdapter 선택→프로필 CRUD 흐름은 미클릭. probe 계약은 health 응답으로 보장됨 |
| 스크린리더 | 미검증 | M0 인계 #10 계속. MemorySlot role="img"+aria-label·Memory 다이얼로그 구조는 코드 수준 |

---

## 5. 파일 트리 (git 추적 기준, 신규·변경)

```
messages/
  ko.json                            # M6 신규 UI 문자열 ~33키 (변경)
  en.json
content/
  memory/                            # ← 신규: 기억술 사전
    ko-words.json                    # 한글 아동 어휘 158단어
    en-words.json                    # 영어 136단어
  lessons/                           # ← 신규: 제8장 5레슨
    ch8-square-4digit.json  ch8-mul-3x2.json  ch8-square-5digit.json
    ch8-mul-3x3.json  ch8-mul-5x5.json
server/                              # ← 신규: 셀프호스트 서버
  index.ts                           # Bun+Hono 단일 파일(/api/health·CRUD·정적 서빙)
  schema.ts                          # SQLite 스키마+CRUD+export/import(왕복 테스트 재사용)
  roundtrip.ts                       # 왕복 이식 테스트(bun run, 17단언)
  Dockerfile                         # 2단계(노드 빌드→oven/bun 런타임)
docs/
  memory-system-ko.md                # ← 신규: 한글 자음 매핑 설계 근거
  self-host.md                       # ← 신규: bun/Docker/NAS 안내 + REST 계약
scripts/
  gen-memory-words.ts                # ← 신규: 사전 생성 throwaway(인코더로 digits 계산)
src/
  App.svelte                         # memory 라우트 분기 (변경)
  components/
    StepPlayer.svelte                # BASE_MS memory 엔트리 (변경)
    MemorySlot.svelte                # ← 신규: 단어 카드/손 변형 메모리 슬롯
  routes/
    Home.svelte                      # 기억술 CTA (변경)
    Settings.svelte                  # ← ExportBundle 내보내기/가져오기 UI(미리보기+merge/replace) (변경)
    Memory.svelte                    # ← 신규: 기억술 양방향 연습(숫자↔단어)
  lib/
    memory/                          # ← 신규: 기억술 공통 엔진(순수 함수)
      types.ts  korean-ko.ts  major-en.ts  engine.ts  engine.test.ts
    engine/
      types.ts                       # 5 method + MemoryStep + 5 시각화 모델 + CarryPrediction (변경)
      derive.ts                      # 8장 dispatch (변경)
      derive-adv.ts                  # ← 신규: 8장 5기법 + 자리올림 선예측
      derive-adv.test.ts             # ← 신규 21 테스트(독립 산술 대조)
      generate.ts                    # 8장 5종 생성 (변경)
    lesson/
      loader.ts                      # METHODS 5종 추가 (변경)
      LessonPlayer.svelte            # techniqueVisual 'adv'(MemorySlot+XDiagram) (변경)
    profiles/app-state.svelte.ts     # exportData/importData (변경)
    router/hash-router.svelte.ts     # memory 라우트 (변경)
    router/hash-router.test.ts       # memory 케이스 (변경)
docs/briefs/M6-RESULT.md             # 이 문서
```

생성물 `src/lib/paraglide/` 는 gitignore(M0~M7 과 동일). `mathemagics.pdf` 미접근.

---

## 6. 커밋 (로컬, push 안 함)

```
<커밋 예정 — conventional commits, 로컬만>
feat(m6): memory system (ko consonant + en Major) + Ch8 advanced multiplication + self-host Bun server + ExportBundle UI
```
`git status -sb` → `## main...origin/main [ahead 18]`(M6 커밋 전). **push 안 함**(브리프 §4 규약).

---

## 7. 미해결 이슈 / 최종 요약

| # | 항목 | 심각도 | 비고 |
|---|---|---|---|
| 1 | **대화형 preview 미검증** | 중 | §4.5. 오케스트레이터가 브라우저에서 기억술 연습·8장 레슨(XDiagram+MemorySlot)·가져오기 미리보기/merge 직접 확인. 엔진·왕복은 단위/실구동 테스트로 보장 |
| 2 | **Docker 빌드 미검증** | 중 | §4.5. Dockerfile 은 표준 구조. daemon 있으면 `docker build -f server/Dockerfile` 로 확인 |
| 3 | **한글 매핑 음성 비일관성** | 낮음 | 종성 ㅇ(소리 /ŋ/)과 초성 ㅇ(무음)을 같은 0으로 읽음. 글자 규칙의 단순함을 위해 수용(docs/memory-system-ko.md §7 솔직 명시) |
| 4 | **en 인코더는 규칙+사전 오버라이드 방식** | 낮음 | knight→21처럼 흔한 묵음·digraph는 처리하고 불규칙 발음은 연습 사전에서 검증한 digits로 고정. 일반 목적 음소 분석기는 아님 |
| 5 | **8장 레슨 연습이 답 전체 타이핑** | 낮음 | M4/M5 인계 계속. 거대 답(최대 10자리)은 DigitInput 으로 처리되나 단계별 채우기는 별도 |
| 6 | **스크린리더 실측 미수행** | 중 | M0 인계 #10 계속 |

### 최종 요약 — PLAN 전체 범위 닫힘

이것이 PLAN.md §8 의 마지막 마일스톤(M6)이다. M0~M5·M7 위에 기억술·8장 고급 곱셈·셀프호스트 서버·ExportBundle UI 를 얹어
**PLAN §0 의 모든 목표(레슨 모듈·세로셈·진도/SRS·Pages 배포·SQLite 옵션)가 구현**됐다. 4 트랙(A 암산·B 지필·C 기억술·D 마술) 전 챕터(1~9)가
스킬트리에 편입됐다. 남은 것은 오케스트레이터의 **브라우저 실측·Docker 빌드·Pages 실배포**(모두 push/환경 의존)뿐이다.
```
