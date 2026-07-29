# Mathemagics Interactive

> 아이들(8–13세)을 위한 벤저민식 암산(mathemagics) 인터랙티브 학습 웹앱.
> A mental-math (Arthur Benjamin style) learning web app for kids 8–13.

🌐 **라이브 데모:** <https://cskwork.github.io/mathemagics-interactive/>

Arthur Benjamin & Michael Shermer의 *Mathemagics*(1993) 기법 체계를 바탕으로 하되, 모든 설명·예제는 자체 작성/생성한다 (원문 미복제).

- **계획서**: [PLAN.md](PLAN.md) — 커리큘럼, 교수 설계, 세로셈 렌더링/입력 스택, 아키텍처, 마일스톤
- **리서치**: [docs/research/](docs/research/) — 책 콘텐츠 맵, 교육 트렌드, 세로셈 표기·에디터, 호스팅 아키텍처

## 핵심 설계

- **호스팅**: GitHub Pages 정적 배포(기본, IndexedDB 저장) + 셀프호스트 옵션(Bun + SQLite)
- **스택**: Vite + Svelte 5 + TypeScript, PWA(오프라인 지원)
- **i18n**: 한국어 기본 + 영어, 프로필별 언어 스위칭, 로케일 확장 가능
- **세로셈**: 커스텀 CSS Grid 렌더러 + digit-cell 에디터 + 가상 넘패드

## 디자인 시스템 — “마술사의 무대”

객석(다크 서피스) · 스포트라이트(앰버) · 박수(성공 초록) · 어깨(오답 적색)의 의미론적 토큰(`src/lib/ui/tokens.css`). 모든 색·폰트·간격은 토큰으로 통일한다(inline 리터럴 금지).

- **아이콘**: 모든 UI 아이콘은 단일 SVG 컴포넌트 `src/components/Icon.svelte`(`currentColor`, 1em)로 통일 — OS마다 들쭉날쭉하게 렌더되는 emoji를 대체.
- **아바타**: 프로필 아바타는 “무대 배지” SVG(`src/components/Avatar.svelte`) — stage-mid 원 + spotlight 고리 + 앰버 동물 글리프. 안정적 id로 저장하며 구 emoji 값은 자동 폴백해 과거 프로필도 깨지지 않는다.

## 디자인 툴링 — Impeccable

[Impeccable](https://impeccable.style) 디자인 스킬로 AI 생성 UI의 단점(한쪽 면만 두꺼운 보더, 보라–파랑 그라데이션, 다크 글로우 등)을 점검하고 제거한다(60종 결정론적 감지 규칙).

```bash
npx impeccable detect src/     # 디자인 안티패턴 스캔 (현재 0건)
```

## 개발

```bash
npm install
npm run dev          # 개발 서버
npm run check        # svelte-check (타입 + a11y)
npm test             # vitest 단위 테스트
npm run test:e2e     # Playwright + axe (a11y · 반응형)
npm run build        # 프로덕션 빌드 → dist/
```

## 라이선스 관련

원서 PDF 등 저작권 자료는 이 저장소에 포함하지 않는다.
