# M0 결과 — 스캐폴드

구현자: Opus 5 · 완료: 2026-07-28 · 브리프: [M0.md](M0.md)
상태: **브리프 §2 전 항목 구현, §3 완료 기준 전부 검증 통과**. push 안 함(커밋 8개, 로컬).

---

## 1. 한 줄 요약

Vite 8 + Svelte 5(runes) + TypeScript strict 정적 SPA 스캐폴드가 섰다.
해시 라우팅·PWA·IndexedDB 저장 계층(어댑터 런타임 감지)·멀티 프로필 CRUD·ko/en i18n(Paraglide)이
동작하며, `npm run check` / `npm test` / `npm run build` 셋 다 통과하고 CI·Pages 배포 워크플로가 붙어 있다.

---

## 2. 결정 사항과 근거

### 2.1 i18n 라이브러리 — **Paraglide JS 2.23** 채택 (vs svelte-i18n 4.0.1)

PLAN.md §6.2 가 "M0에서 비교 후 확정"으로 남겨 둔 항목. 두 후보를 실제 설치·빌드해 비교했다.

| 항목 | **Paraglide JS 2.23** | svelte-i18n 4.0.1 |
|---|---|---|
| 클라이언트 런타임 의존성 | **0** (메시지가 트리셰이킹 가능한 함수로 컴파일됨) | `intl-messageformat`, `deepmerge`, `estree-walker` 등 **7개** |
| 메시지 id 타입 안전성 | **컴파일 타임** — 오타는 `svelte-check` 가 잡는다 | 없음 (문자열 키) |
| 누락 번역 폴백 | 컴파일러가 baseLocale(ko)로 폴백 코드를 생성 | `fallbackLocale` 런타임 설정 |
| 로케일 추가 비용 | `messages/<code>.json` + `project.inlang/settings.json` 의 `locales` 한 줄 | JSON + `register()` 호출 |
| PLAN §6.2 의 "컴파일 타임 i18n 라이브러리" 요구 | 충족 | 미충족(런타임 사전) |
| 빌드 복잡도 | vite 플러그인 + 생성 디렉터리(gitignore 대상) | 없음 |
| 최신 릴리스 | 2.23.0 (활발) | 4.0.1 (2024) |

**결정 근거(우선순위 순)**

1. **의존성 최소주의(브리프 §4)와 저사양 태블릿 타깃.** svelte-i18n 은 `intl-messageformat` 을 클라이언트
   번들에 싣는다. Paraglide 는 `@inlang/paraglide-js` 를 devDependency 로만 쓰고 번들에는 아무것도 남기지 않는다.
   빌드 산출물에 `urlpattern-polyfill`/전략 코드가 섞이지 않은 것을 `grep` 으로 확인했다(0건).
2. **TS strict 와의 정합.** 메시지 id 가 타입이 된다. `m.no_such_message()` 를 일부러 넣어
   `svelte-check` 가 `Property 'no_such_message' does not exist ...` 로 실패하는 것을 확인한 뒤 되돌렸다.
3. PLAN.md §6.2 가 명시적으로 "컴파일 타임 i18n 라이브러리"를 요구한다. svelte-i18n 은 런타임 사전 방식이라
   이 요구를 원래 만족하지 않는다.

**리스크와 그 처리 — 반응성.** Paraglide 의 기본 `setLocale()` 은 페이지를 리로드한다. 프로필별 즉시 전환에는
부적합하므로 다음 어댑터를 넣었다 (`src/lib/i18n/locale.svelte.ts`):

```ts
let active = $state<Locale>(baseLocale);
overwriteGetLocale(() => active);      // 메시지 함수가 호출 시점에 이 시그널을 읽는다
overwriteSetLocale((next) => { active = next; });
```

생성물(`src/lib/paraglide/messages/*.js`)이 메시지마다
`const locale = experimentalStaticLocale ?? options.locale ?? getLocale()` 를 호출하고,
`runtime.js` 가 `export let getLocale` (live binding) 이라 `overwriteGetLocale` 로 교체하면
템플릿 안의 `m.foo()` 가 자동으로 `$state` 를 구독한다. **리로드 없이 즉시 전환되는 것을 브라우저에서 확인**(§4).

### 2.2 SvelteKit 미채택 (순수 Vite + Svelte)

브리프 §2-1 이 "Kit adapter-static 이 명백히 유리하면 채택 가능"으로 열어 뒀으나 채택하지 않았다.
SSR/프리렌더가 필요 없고(해시 라우팅), 라우팅 총량이 3개이며, Kit 을 넣으면 파일 기반 라우팅·`$app/*` 규약·
adapter 설정이 얹히는 반면 얻는 것이 없다. 정적 SPA 로서는 Vite 가 더 얇다.

### 2.3 라우터 자체 구현 (svelte-spa-router 미사용)

필요한 기능이 "해시 문자열 → 라우트 id" 하나뿐이고, `svelte-spa-router` 의 Svelte 5 runes 호환은
`docs/research/architecture-hosting.md` "확인하지 않은 것" 에 재확인 대상으로 남아 있던 항목이다.
`src/lib/router/hash-router.svelte.ts` 62줄, 의존성 0.

### 2.4 TypeScript **6.0.3** (7.0.2 아님)

`npm view typescript dist-tags` 기준 latest 는 7.0.2(Go 포트)지만, `svelte-check@4.7.4` 의
peerDependency 가 `typescript: ^5.0.0 || ^6.0.0` 이라 7 은 검증 범위 밖이다. 검증 도구가 지원을 선언한
최신 버전인 6.0.3 을 고정했다. svelte-check 가 TS 7 을 선언하면 올릴 수 있다.

### 2.5 어댑터 감지 — health probe 를 status 200 만으로 판정하지 않는다

**preview 검증 중 실제로 발견한 버그.** `vite preview` 의 SPA 폴백이
`GET /mathemagics-interactive/api/health` 에 **200 `text/html`** 을 돌려주는 것을 브라우저에서 확인했다
(로그: `health probe result: {"status":200,"ct":"text/html"}`). 리서치 문서 §1.1 스케치대로 `r.ok` 만
봤다면 로컬 preview 와 일부 정적 호스트에서 RestAdapter 가 잘못 선택된다.

→ probe 는 이제 **세 조건을 모두** 요구한다: `status ok` + `content-type: application/json` +
본문 `{ app: "mathemagics" }`. 이것이 M6 Bun 서버의 `GET <base>api/health` 계약이다.

### 2.6 API base 를 Vite `base` 에서 파생

리서치 문서 스케치는 절대경로 `/api/health` 였다. 셀프호스트 서버가 정적 빌드를 어떤 경로에 마운트하든
같은 상대 위치에서 API 를 찾도록 `apiBaseUrl(import.meta.env.BASE_URL)` → `<base>api/` 로 바꿨다.
GitHub Pages 에서는 이 경로가 404 이므로 자연히 로컬 저장으로 폴백한다.

### 2.7 기타

- **Dexie 스키마**: `srsCards` 에 `[profileId+due]` 복합 인덱스 — `getDueCards` 범위 질의 전용.
  이 인덱스가 IndexedDB 채택 이유 그 자체다(PLAN §6.1).
- **`deleteProfile` cascade 를 트랜잭션 안에서** 수행. 프로필만 지우고 진도가 남으면 유령 레코드가
  export 번들에 섞인다.
- **PWA 아이콘 PNG 192/512 추가**. PWA 설치는 편의가 아니라 Safari ITP 7일 축출의 주 방어선(PLAN §10-4)이고,
  Android 설치 프롬프트는 PNG 를 요구한다. SVG 원본을 ImageMagick 으로 래스터화.
- **`src/lib/paraglide/` 는 생성물**이라 gitignore 한다. `package.json` 의 `prepare` 훅이 `npm ci` 뒤
  자동으로 컴파일하므로 CI 도 별도 스텝이 필요 없다. `npm run check` 는 vite 를 거치지 않으므로
  스크립트 앞에 `npm run i18n` 을 붙였다.
- **tsconfig**: `strict` 에 더해 `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `noUnusedLocals/Parameters` 를 켰다. Paraglide 생성 `.js` 는
  `checkJs: false` 로 타입 소스로만 쓴다.

---

## 3. 추가한 의존성 (전부 한 줄 사유)

### dependencies (클라이언트 번들에 들어감)

| 패키지 | 버전 | 사유 |
|---|---|---|
| `dexie` | ^4.4.4 | IndexedDB 래퍼 — 스키마 버저닝·복합 인덱스·트랜잭션이 내장돼야 SRS due 질의를 직접 짜지 않는다 (PLAN §6.1 확정 사항) |

**클라이언트 런타임 의존성은 이것 하나뿐이다.** 번들 156KB(gzip 53.7KB) 중 Dexie 가 ~85KB 로 대부분을 차지한다.

### devDependencies

| 패키지 | 버전 | 사유 |
|---|---|---|
| `vite` | ^8.1.5 | 빌드 도구 (PLAN §6.2 확정) |
| `svelte` | ^5.56.8 | UI 프레임워크 (PLAN §6.2 확정) |
| `@sveltejs/vite-plugin-svelte` | ^7.0.2 | Vite ↔ Svelte 연결. svelte 를 쓰려면 필수 |
| `typescript` | ^6.0.3 | 타입 시스템. svelte-check peer 범위 상한 |
| `svelte-check` | ^4.7.4 | `npm run check` 의 본체 — `.svelte` 안 TS 까지 검사 (PLAN §9 지정 검증 명령) |
| `vitest` | ^4.1.10 | `npm test` 의 본체 (PLAN §9 지정 검증 명령) |
| `fake-indexeddb` | ^6.2.5 | DexieAdapter 계약 테스트를 브라우저 없이 node 환경에서 돌리기 위한 IndexedDB 구현 |
| `vite-plugin-pwa` | ^1.3.0 | 오프라인 프리캐시 + 매니페스트 (브리프 §2-3 지정) |
| `@inlang/paraglide-js` | ^2.23.0 | i18n 컴파일러 (§2.1 결정). 번들에는 아무것도 남기지 않는다 |
| `@types/node` | ^22.19.0 | `vite.config.ts` 등 Node 문맥 타입 |

**jsdom/happy-dom 은 넣지 않았다** — 계약 테스트가 DOM 을 요구하지 않으므로 `environment: 'node'` 로 충분하다.

---

## 4. 완료 기준 검증

### 4.1 명령 3종 — 전부 통과 (출력 원문)

```
$ npm run check ; echo EXIT=$?

> mathemagics-interactive@0.0.0 check
> npm run i18n && svelte-check --tsconfig ./tsconfig.json


> mathemagics-interactive@0.0.0 i18n
> paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide --strategy baseLocale

ℹ [paraglide-js] Compiling inlang project ...
✔ [paraglide-js] Successfully compiled inlang project.
1785195033900 START "/Users/<user>/Documents/PARA/Resource/mathemagics-interactive"
1785195033904 COMPLETED 927 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
EXIT=0
```

```
$ npm test ; echo EXIT=$?

> mathemagics-interactive@0.0.0 test
> vitest run


 RUN  v4.1.10 /Users/<user>/Documents/PARA/Resource/mathemagics-interactive


 Test Files  5 passed (5)
      Tests  26 passed (26)
   Start at  08:30:34
   Duration  451ms (transform 471ms, setup 196ms, import 562ms, tests 89ms, environment 0ms)

EXIT=0
```

```
$ npm run build ; echo EXIT=$?

> mathemagics-interactive@0.0.0 build
> vite build

vite v8.1.5 building client environment for production...
✔ [paraglide-js] Compilation complete (message-modules)
transforming...✓ 163 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                0.18 kB
dist/manifest.webmanifest         0.62 kB
dist/index.html                   1.04 kB │ gzip:  0.54 kB
dist/assets/index-CDmFyteA.css    1.49 kB │ gzip:  0.69 kB
dist/assets/index-B5K3z_Ab.js   156.03 kB │ gzip: 53.67 kB

✓ built in 479ms

PWA v1.3.0
mode      generateSW
precache  12 entries (166.00 KiB)
files generated
  dist/sw.js
  dist/workbox-abeb32eb.js

EXIT=0
```

**CI 순서 견고성**: 생성물 `src/lib/paraglide/` 를 지운 상태에서 `npm test`, `npm run build`,
`npm run check` 를 각각 단독 실행해 셋 다 EXIT=0 인 것을 확인했다 (각 명령이 스스로 컴파일한다).
CI 스텝 순서나 `prepare` 훅 실행 여부에 의존하지 않는다.

`svelte-check` 가 실제로 `.svelte` 를 검사하는지 확인하기 위해 `Home.svelte` 에 없는 메시지 호출을
일부러 넣었더니 다음과 같이 실패했고(그 뒤 되돌림):

```
1785194411103 ERROR "src/routes/Home.svelte" 19:11 "Property 'no_such_message_deliberate_error' does not exist on type 'typeof import(".../src/lib/paraglide/messages/_index")'."
1785194411107 COMPLETED 927 FILES 1 ERRORS 0 WARNINGS 1 FILES_WITH_PROBLEMS
```

### 4.2 테스트 26개 (5파일)

- `src/lib/storage/dexie-adapter.test.ts` (8) — 프로필 upsert/정렬/중복없음, **cascade 삭제**,
  due 카드 범위+경계값+limit+타 프로필 격리, 설정 미존재 시 undefined, `exportAll` 스키마 스탬프,
  `import replace` 전체 교체, `import merge` last-write-wins 양방향
- `src/lib/storage/index.test.ts` (8) — `apiBaseUrl` 파생, probe 성공→Rest, **SPA 폴백 200 text/html→Dexie**,
  JSON 이지만 우리 payload 아님→Dexie, 404→Dexie, 네트워크 거부→Dexie, 타임아웃→Dexie, 800ms 예산 고정
- `src/lib/storage/migrations.test.ts` (3) — 누락 컬렉션 정규화, 비-mathemagics 번들 거부, 신버전 번들 거부
- `src/lib/router/hash-router.test.ts` (5) — 라우트 매핑, 쿼리/트레일링 슬래시 무시, 미지 경로 undefined, 왕복
- `src/lib/content/localized.test.ts` (2) — 로케일 선택, ko 폴백

### 4.3 preview 수동 검증 (base path + 해시 라우팅 + 영속 + ko↔en)

`npm run build && npx vite preview --port 4173` 후 실제 Chromium 으로 조작해 확인했다.

| 확인 항목 | 결과 |
|---|---|
| base path 하에서 로드 | `http://localhost:4173/` → 302 → `/mathemagics-interactive/` 200, 앱 정상 부팅 |
| 어댑터 감지 | probe 가 200 `text/html` 을 받았지만 **DexieAdapter 로 폴백**. 설정 화면에 "이 기기 (브라우저)" 표시 |
| 프로필 생성 | 이름 "하늘" + 아바타 🦉 저장 → `#/home` 으로 이동, `안녕, 하늘!` |
| 저장 위치 | `indexedDB.databases()` = `["mathemagics@10"]`, `localStorage["mathemagics.lastProfileId"]` = uuid |
| **새로고침 후 유지** | `location.reload()` → `#/home` 에서 `안녕, 하늘!` 그대로 |
| **ko↔en 스위칭** | 설정에서 "English" 클릭 → **리로드 없이 전 화면 즉시 영어**. IndexedDB `settings` 행이 `locale: "en"` 으로 저장됨 |
| 로케일 영속 | 새로고침 후에도 영어 유지 |
| **로케일이 프로필 단위** | 새 프로필 "Rin" 생성 → UI 가 ko 로 복귀(신규 프로필 기본값). 다시 "하늘" 선택 → 영어로 복귀 |
| 이름 변경 | "Rin" → "Rin2" 목록에 즉시 반영 |
| 삭제 + cascade | "Rin2" 삭제 후 IndexedDB `profiles`=["하늘"], `settings` 행 1개 (프로필 설정도 함께 삭제됨) |
| 미지 해시 | `#/nope` → "없는 화면이에요." + 프로필 목록으로 가는 버튼 |
| 빌드 산출물 경로 | `index.html` 의 script/css/manifest/icon 이 전부 `/mathemagics-interactive/...` 로 접두됨 |
| PWA manifest | `scope`/`start_url` = `/mathemagics-interactive/`, 아이콘 4종 등재, precache 12 entries |

**검증하지 않은 것**: 실제 GitHub Pages URL 배포(브리프 §4 의 push 금지 규약 때문에 불가 — 오케스트레이터가
push 후 확인해야 함). Safari/iOS 동작. 서비스워커의 오프라인 재방문 동작(preview 에서 SW 등록만 확인).
`RestAdapter` 의 실제 HTTP 왕복(서버가 M6 이므로 stub).

---

## 5. 파일 트리 (git 추적 기준, 신규만)

```
.github/workflows/
  ci.yml                       # push/PR: check + test + build
  deploy.yml                   # main push: 게이트 통과 후 actions/deploy-pages
index.html
package.json
tsconfig.json                  # strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
svelte.config.js               # vitePreprocess + runes:true
vite.config.ts                 # base, paraglide, svelte, VitePWA, vitest 설정
project.inlang/settings.json   # baseLocale: ko, locales: [ko, en]
messages/
  ko.json                      # 기본 로케일
  en.json
public/
  icon.svg  icon-192.png  icon-512.png  apple-touch-icon.png
src/
  main.ts                      # mount()
  App.svelte                   # 부팅 + 라우트 스위치
  app.css                      # 최소 스타일 (터치 48px, 본문 16px, reduced-motion)
  components/
    LocaleSwitcher.svelte
  routes/
    ProfilePicker.svelte       # 프로필 생성/선택/이름변경/삭제
    Home.svelte                # placeholder (레슨은 M2)
    Settings.svelte            # 언어/소리/목표 + 저장 위치 표시
  lib/
    storage/
      types.ts                 # Profile, ProgressRecord, SrsCard, Settings, ExportBundle, StorageAdapter
      dexie-adapter.ts         # IndexedDB 구현 (+ cascade, due 인덱스, merge LWW)
      rest-adapter.ts          # M6 용 stub
      migrations.ts            # ExportBundle 순차 마이그레이션 (CURRENT_SCHEMA=1)
      persistence.ts           # navigator.storage.persist()
      index.ts                 # createAdapter() 런타임 감지 + re-export
      *.test.ts                # 계약/폴백/마이그레이션 테스트
    i18n/
      locale.svelte.ts         # $state + overwriteGetLocale 어댑터
    content/
      localized.ts             # { ko, en } 로케일 키 타입 + ko 폴백 (M0 은 타입만)
      localized.test.ts
    router/
      hash-router.svelte.ts    # 의존성 0 해시 라우터
      hash-router.test.ts
    profiles/
      app-state.svelte.ts      # 어댑터+프로필+설정 상태
      last-profile.ts          # localStorage 는 이 플래그 하나만
  tests/
    setup.ts                   # fake-indexeddb/auto
```

생성물 `src/lib/paraglide/` 는 gitignore 대상(`npm run i18n` 이 만든다).
`mathemagics.pdf` 는 건드리지 않았고 추적되지 않는다(`git ls-files | grep pdf` → 0건).

---

## 6. 커밋 (로컬 8개, push 안 함)

```
33207b5 fix(storage): health probe 가 SPA 폴백 200 응답을 서버 모드로 오인하지 않도록
8ca4752 ci: check/test/build 게이트 + GitHub Pages 배포 워크플로
ba99f8f feat(profiles): 멀티 프로필 CRUD + 프로필별 언어 스위처 화면
13a06d2 feat(router): 의존성 0 해시 라우터
825fb9a feat(i18n): Paraglide JS 기반 ko/en + 레슨 콘텐츠 로케일 키 규약
26c2075 feat(storage): StorageAdapter 인터페이스 + DexieAdapter + 런타임 어댑터 감지
c7498c6 chore(scaffold): Vite 8 + Svelte 5 + TypeScript strict 프로젝트 구성
(+ 이 문서 커밋)
```

---

## 7. 미해결 이슈 / 다음 마일스톤 인계 사항

| # | 항목 | 심각도 | 비고 |
|---|---|---|---|
| 1 | **Pages 실제 배포 미검증** | 중 | push 금지 규약이라 로컬 preview 까지만 확인. 저장소 Settings → Pages Source 를 "GitHub Actions" 로 바꿔야 `deploy.yml` 이 동작한다. 저장소 이름이 `mathemagics-interactive` 가 아니면 `vite.config.ts` 의 `BASE` 를 고쳐야 한다 |
| 2 | **`npm audit` high 8건** | 낮음 | 전부 `vite-plugin-pwa → workbox-build → @trickfilm400/rollup-plugin-off-main-thread → ejs/jake/filelist/minimatch → brace-expansion` 빌드 타임 체인. 클라이언트 번들에 들어가지 않는다. `audit fix --force` 는 vite-plugin-pwa 를 깨뜨리므로 하지 않았다. workbox 7.4.x 갱신 대기 |
| 3 | **네이티브 `confirm`/`prompt` 사용** | 중 | `ProfilePicker.svelte` 의 이름변경/삭제. 메인 스레드를 막고 8–13세 대상 UX(PLAN §7.2)에 맞지 않는다. M2 에서 인앱 다이얼로그 + "부모 게이트"(architecture-hosting §5)로 교체할 것 |
| 4 | **`RestAdapter` 는 stub** | 예정됨 | 인터페이스와 URL 규약만 확정. 서버 본체·왕복 이식 테스트는 M6. `GET <base>api/health` 는 `{"app":"mathemagics"}` 를 `application/json` 으로 돌려줘야 한다 |
| 5 | **`ExportBundle` 내보내기/가져오기 UI 없음** | 예정됨 | 어댑터 메서드와 마이그레이션 골격은 있으나 화면이 없다. "진도 백업하기" 버튼은 M6 (PLAN §10-4 의 방어책 3번) |
| 6 | **`navigator.storage.persist()` 는 Chrome preview 에서 denied** | 낮음 | 설치되지 않은 사이트라 정상. 설정 화면이 "브라우저가 데이터를 지울 수 있어요" 를 보여주도록 처리했다. 홈 화면 설치 유도 온보딩은 M2+ |
| 7 | **TypeScript 7 미사용** | 낮음 | svelte-check peer 범위 밖(§2.4). svelte-check 가 TS7 을 선언하면 올린다 |
| 8 | 프로필 선택 화면의 로케일 | 낮음 | 활성 프로필이 없으면 baseLocale(ko)로 되돌아간다 — 의도된 동작이지만, 영어만 쓰는 가정에서는 프로필 목록만 한국어로 보인다. 필요하면 "마지막 로케일" 을 localStorage 에 캐시하는 것이 최소 수정 |
| 9 | Dexie 가 번들의 55% | 낮음 | 156KB 중 ~85KB. PLAN §6.1 이 IndexedDB 를 확정했고 SRS due 질의가 실제로 인덱스를 요구하므로 수용. 문제가 되면 `idb`(~1KB) + 수제 스키마 버저닝으로 교체 가능 |
| 10 | 접근성 미검증 | 중 | `aria-live` 스텝 낭독 등 PLAN §5.3 요구는 세로셈이 생기는 M1 부터. M0 은 터치 타깃/포커스 링/`prefers-reduced-motion` 만 지켰고 스크린리더 실측은 하지 않았다 |
