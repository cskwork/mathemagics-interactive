# Z.ai Vision MCP Server — 이미지 읽기 보조 도구 연구

> 작성: 2026-07-31
> 목적: Jcode에서 이미지를 읽지 못하는 문제를 GLM 비전 모델로 보완하기 위한 조사

## TL;DR

Z.ai가 제공하는 **Vision MCP Server** (`@z_ai/mcp-server`)를 연결하면 GLM-4.6V 비전 모델로 이미지를 분석할 수 있다. GLM Coding Plan 가입자 전용이며, Claude Code / Cline / OpenCode / Crush / Jcode 등 MCP 호환 클라이언트에서 모두 사용 가능하다.

## 핵심 사실

| 항목 | 내용 |
|---|---|
| 공식 명칭 | Vision MCP Server (`@z_ai/mcp-server`) |
| 백엔드 모델 | GLM-4.6V (이미지) + 동영상 분석 지원 |
| 접근 조건 | GLM Coding Plan 구독 필요 (API 키) |
| API 키 발급 | https://z.ai/manage-apikey/apikey-list |
| 요구사항 | Node.js ≥ v22.0.0 |
| 호환 클라이언트 | Claude Code, Cline (VS Code), OpenCode, Crush, Roo Code, Kilo Code, 기타 MCP 호환 |
| 문서 | https://docs.z.ai/devpack/mcp/vision-mcp-server |

## 제공되는 도구 (8개)

MCP 서버가 노출하는 툴:

1. `ui_to_artifact` — UI 스크린샷 → 코드/프롬프트/스펙/설명 변환
2. `extract_text_from_screenshot` — OCR (코드, 터미널, 문서, 일반 텍스트)
3. `diagnose_error_screenshot` — 에러 스냅샷 분석 및 수정 제안
4. `understand_technical_diagram` — 아키텍처/플로우/UML/ER/시스템 다이어그램 해석
5. `analyze_data_visualization` — 차트/대시보드 읽고 인사이트 도출
6. `ui_diff_check` — 두 UI 스크린샷 비교 (drift 감지)
7. `image_analysis` — 범용 이미지 이해 (위 항목에 안 맞을 때)
8. `video_analysis` — 비디오 분석 (로컬/원격 ≤8MB, MP4/MOV/M4V)

## 설치 방법

### 사전 준비
1. https://z.ai/manage-apikey/apikey-list 에서 API 키 발급
2. Node.js 22+ 확인: `node -v`

### Jcode에 MCP 서버 추가

Jcode의 MCP 설정에 추가:

```json
{
  "mcpServers": {
    "zai-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@z_ai/mcp-server@latest"],
      "env": {
        "Z_AI_API_KEY": "본인_API_키",
        "Z_AI_MODE": "ZAI"
      }
    }
  }
}
```

> `@latest` 태그 필수 (캐시된 구버전 방지). 현재 안정 버전 ≥ 0.1.2.

### 설치 확인 (터미널)
```bash
Z_AI_API_KEY=본인_API_키 npx -y @z_ai/mcp-server
```
정상 실행되면 환경/권한 문제 없음.

## 사용법

이미지를 **로컬 디렉토리에 저장**한 뒤 경로로 참조:

```
What does demo.png describe?
이 스크린샷 error.png의 에러 원인 분석해줘
```

⚠️ **중요**: 클라이언트에 이미지를 직접 붙여넣으면 MCP를 타지 않고 클라이언트 내장 모델이 처리함. 반드시 파일 경로로 지정해야 GLM-4.6V가 분석.

## 이 프로젝트(mathemagics-interactive) 적용 포인트

- `e2e/artifacts/screenshots/` 의 반응형 스크린샷 자동 검수
- UI 회귀 비교 (`ui_diff_check`) — 디자인 drift 감지
- 에러 스크린샷 디버깅 (`diagnose_error_screenshot`)
- 레슨 콘텐츠 내 수식/다이어그램 이미지 이해

## 알려진 이슈 / 트러블슈팅

| 증상 | 해결 |
|---|---|
| Connection closed | Node.js 22+ 확인, `node -v` / `npx -v` 실행, API 키 재확인 |
| Invalid API Key | 키 복사 정확도, 활성화 여부, Z_AI_MODE 일치, 잔액 확인 |
| Connection timeout | 네트워크/방화벽 확인, 타임아웃 증가 |
| 구버전 실행 | npx 캐시 삭제 또는 `@latest` 태그 사용 |

## 참고
- Z.ai 모델 API: https://z.ai/model-api
- GLM-4.6V 소개: https://docs.z.ai/guides/vlm/glm-4.6v
- Vision MCP 문서: https://docs.z.ai/devpack/mcp/vision-mcp-server
- GLM-V GitHub: https://github.com/zai-org/GLM-V
