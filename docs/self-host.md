# 셀프호스트 가이드 — Bun 서버(Bun + Hono + bun:sqlite)

> M6 산출물(PLAN §6.1, architecture-hosting.md §2b). 같은 정적 빌드(dist/) 를 그대로 쓰면서
> 데이터를 SQLite 파일에 저장·가족·교실 단위로 공유하는 모드. 앱은 부팅 시 `/api/health` probe 로
> 서버 유무를 자동 감지한다(정적 호스팅이면 IndexedDB 로 폴백).

## 언제 쓰나요?

- 여러 기기(아이패드 + PC)에서 **같은 진도**를 쓰고 싶을 때.
- 브라우저 데이터 축출(Safari ITP 7일)을 **근본적으로** 피하고 싶을 때.
- 교실 단위 다계정이 필요할 때.

LAN 전용을 전제로 합니다. 인터넷 노출은 스코프 밖입니다(필요 시 Tailscale·역방향 프록시 권장).

## 사전 준비

1. 정적 빌드 만들기: `npm run build` → `dist/` 생성.
2. Bun 설치(Bun 만 필요, Node 는 빌드에만): <https://bun.sh> 의 설치 스크립트.

## 방법 A — Bun 직접 실행(가장 단순)

```bash
npm run build
bun run server/index.ts
# 환경변수로 조정 가능:
#   PORT(기본 3000) · DB_PATH(기본 ./server/data.sqlite) · STATIC_DIR(기본 ./dist)
PORT=8080 DB_PATH=/var/lib/mathemagics/data.sqlite bun run server/index.ts
```

브라우저에서 `http://<서버IP>:8080/mathemagics-interactive/` 열기. 설정 화면의 "저장 위치"가
**셀프호스트 서버**로 표시되면 정상 감지된 것입니다.

`data.sqlite` 파일 하나가 전체 데이터이므로, 복사만으로 백업·이전이 끝납니다.

## 방법 B — Docker(NAS 추천)

```bash
docker build -f server/Dockerfile -t mathemagics .
docker run -d -p 3000:3000 -v mathemagics-data:/data --name mathemagics mathemagics
```

- Synology·QNAP 등은 컨테이너 매니저에서 같은 설정으로 배포합니다.
- `/data` 볼륨에 `data.sqlite` 가 생깁니다. 볼륨을 백업하면 전체 백업입니다.
- 환경변수: `PORT` · `DB_PATH=/data/data.sqlite` · `STATIC_DIR=/app/dist` · `BASE_PATH`.

## 데이터 이동(정적 ↔ 셀프호스트)

ExportBundle(JSON) 이 두 모드의 공용 통화입니다.

- **내보내기**: 설정 화면 → "진도 내보내기" → `mathemagics-export-<시각>.json` 다운로드.
- **가져오기**: 다른 모드의 설정 화면 → "진도 가져오기" → 파일 선택 → **미리보기** 후
  `merge`(최신 우선 병합) 또는 `replace`(전체 교체) 선택.

`merge` 는 같은 프로필/스킬/카드를 `lastPlayedAt`/`lastReview` 가 최신인 쪽으로 합칩니다
(architecture-hosting.md §3.1). 형제가 두 기기에서 각자 쓰다 합치는 경우까지 커버합니다.

## `/api/health` 계약

```
GET <base>api/health  →  200  application/json  {"app":"mathemagics","version":"…"}
```

앱의 probe 는 status 200 + JSON content-type + 본문 `{app:"mathemagics"}` **세 조건을 모두**
검사합니다(M0 에서 발견 — 정적 호스트의 SPA 폴백이 200 HTML 을 줄 수 있어서). 서버는 이 형식을
지켜야 합니다(현재 구현 준수).

## REST 엔드포인트(StorageAdapter 와 1:1)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `<base>api/health` | probe |
| GET/PUT/DELETE | `<base>api/profiles[/:id]` | 프로필 CRUD(cascade) |
| GET/PUT | `<base>api/progress` | 진도(`?profileId=`) |
| GET | `<base>api/srs/due` | 복습 카드(`?profileId=&now=&limit=`) |
| PUT | `<base>api/srs` | 카드 upsert |
| GET/PUT | `<base>api/settings/:profileId` | 설정(404 = 미존재) |
| GET | `<base>api/export` | 전체 ExportBundle |
| POST | `<base>api/import?mode=merge\|replace` | 가져오기 |

## 검증 상태(솔직 명시)

- `bun run server/index.ts` 실구동 + `/api/health`·profile/settings CRUD·정적 서빙 curl 확인(RESULT §4).
- `bun run server/roundtrip.ts` 왕복 이식 17단언 통과(RESULT §4).
- Docker 이미지 빌드·기동은 이 환경에서 **미검증**(Docker daemon 없음). Dockerfile 은 단계를
  단순하게 두었으므로 표준 NAS 배포 경로에서 동작할 것으로 예상하지만, 빌드 성공을 직접
  확인하지는 못했습니다.
