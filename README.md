# Mathemagics Interactive

아이들(8–13세)을 위한 벤저민식 암산(mathemagics) 인터랙티브 학습 웹앱.
Arthur Benjamin & Michael Shermer의 *Mathemagics*(1993)의 기법 체계를 바탕으로 하되, 모든 설명·예제는 자체 작성/생성한다 (원문 미복제).

- **계획서**: [PLAN.md](PLAN.md) — 커리큘럼, 교수 설계, 세로셈 렌더링/입력 스택, 아키텍처, 마일스톤
- **리서치**: [docs/research/](docs/research/) — 책 콘텐츠 맵, 교육 트렌드, 세로셈 표기·에디터, 호스팅 아키텍처

## 핵심 설계

- **호스팅**: GitHub Pages 정적 배포(기본, IndexedDB 저장) + 셀프호스트 옵션(Bun + SQLite)
- **스택**: Vite + Svelte 5 + TypeScript, PWA
- **i18n**: 한국어 기본 + 영어, 프로필별 언어 스위칭, 로케일 확장 가능
- **세로셈**: 커스텀 CSS Grid 렌더러 + digit-cell 에디터 + 가상 넘패드

## 라이선스 관련

원서 PDF 등 저작권 자료는 이 저장소에 포함하지 않는다.
