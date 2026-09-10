# Codex plugins by Gabeujin

한국 기술 블로그 조사, 제품 디자인, Canvas 웹 구현을 돕는 세 가지 Codex 플러그인입니다. GitHub에서 소스를 내려받아 사용하는 커뮤니티 마켓플레이스입니다.

| 플러그인 | 하는 일 | 구성 |
|---|---|---|
| [K-Tech Insight Radar](plugins/k-tech-radar) | 한국 기술 블로그의 출처를 보존하며 조사하고 인사이트를 정리 | 스킬 + 로컬 stdio MCP |
| [KGJ Design](plugins/kgj-design) | 제품에 맞는 디자인 규칙을 정의하고 웹·HTML 보고서·Markdown에 적용 | 스킬 + 로컬 stdio MCP |
| [Canvas Web Experiences](plugins/canvas-web-experiences) | Canvas 2D·3D 경험을 설계하고 데모·접근성·대체 동작을 검토 | 스킬 |

## 빠른 설치

플러그인을 지원하는 최신 Codex Desktop/CLI와 Git이 필요합니다. Radar·KGJ의 로컬 MCP에는 **유지보수 중인 Node.js 22 또는 24**이 필요하며, Codex 프로세스의 `PATH`에서 `node`를 찾을 수 있어야 합니다. KGJ의 Python 검증 스크립트에는 Python 3이 필요합니다. Canvas 데모 개발 의존성은 해당 [데모 안내](plugins/canvas-web-experiences/demo/README.md)를 따르세요.

마켓플레이스 등록은 한 번만 실행합니다.

```powershell
codex plugin marketplace add Gabeujin/codex-plugins
```

원하는 플러그인만 골라 설치하거나, 아래 세 명령을 모두 실행하세요.

```powershell
codex plugin add k-tech-radar@gabeujin-plugins
codex plugin add kgj-design@gabeujin-plugins
codex plugin add canvas-web-experiences@gabeujin-plugins
```

CLI에 `plugin add`가 없다면 마켓플레이스 등록 후 Codex의 Plugins 화면에서 표시 이름을 검색해 설치하세요. 설치가 끝나면 **새 작업을 시작**합니다. 기존 작업에는 설치 이전의 스킬·도구 상태가 남을 수 있습니다.

이미 이 마켓플레이스를 등록했다면 중복 등록 대신 다음 명령으로 갱신한 후 새 플러그인을 설치하세요.

```powershell
codex plugin marketplace upgrade gabeujin-plugins
```

고정된 공개 버전으로 처음 설치하려면 등록 명령 끝에 `--ref v0.4.0`을 붙입니다. `v0.4.0`은 이 저장소의 묶음 릴리스 번호이며, 각 플러그인의 버전과 구분합니다. 고정 버전을 사용하는 경우 다음 릴리스를 선택해 명시적으로 갱신하세요.

## 설치 후 이렇게 시작하세요

### K-Tech Insight Radar

> K-Tech Radar로 등록된 소스 상태를 확인하고 토스 테크 카탈로그를 갱신해줘. 검색 결과는 출처와 수집 시점을 함께 보여주고, 접근하지 못한 사이트는 따로 표시해줘.

공개본은 **빈 카탈로그**로 시작합니다. 개발자의 수집 글, 개인 Dictionary, 조사 기록은 포함하지 않습니다. 최초 수집 전 검색 결과가 0개일 수 있습니다. 수집은 구성된 외부 사이트에 접속하며, 사이트의 접근 제한이나 장애가 결과에 영향을 줄 수 있습니다.

### KGJ Design

> KGJ Design으로 작은 도서 기록 서비스의 디자인 방향을 잡아줘. 사용자와 핵심 과업을 먼저 정리하고, 색상·타이포그래피·레이아웃의 선택 근거를 남겨줘. 기존 프로젝트 파일을 고치기 전에 적용 범위를 보여줘.

디자인의 공통 규칙을 재사용하면서 제품의 목적에 맞는 개성을 정의하는 워크플로입니다. 공개 템플릿과 참조 자료가 포함되며 개발자의 개인 Dictionary 기록은 포함하지 않습니다. 저장할 디자인 지식은 사용자가 검토하고 관리하세요.

### Canvas Web Experiences

> Canvas Web Experiences로 제품을 드래그해서 회전하는 작은 3D 데모를 만들어줘. 지원하지 않는 브라우저의 대체 화면과 키보드 조작을 포함하고, 실제 확인한 동작과 확인하지 못한 동작을 나눠 보고해줘.

스킬과 데모 소스가 제공됩니다. 설치만으로 데모 서버가 실행되지는 않습니다. HTML-in-Canvas 관련 실험 경로는 브라우저 지원을 탐지하고 대체 동작을 확인해야 합니다. 모든 브라우저에서 네이티브 경로가 동작한다고 보장하지 않습니다.

## 실행 위치와 데이터

Radar와 KGJ의 MCP는 사용자 컴퓨터에서 Node.js의 stdio 프로세스로 실행됩니다. 이 배포를 사용하기 위한 별도 원격 MCP 서버·Docker·개발자 API 키는 필요하지 않습니다. Codex 계정과 이용 비용은 별도입니다. 추가로 선택하는 외부 도구나 서비스에는 해당 서비스 조건이 적용됩니다.

- Radar의 변경 가능한 데이터는 설치 위치와 관계없이 플러그인 캐시 밖의 사용자 데이터 폴더에 저장됩니다. `K_TECH_RADAR_DATA_DIR`로 별도 경로를 지정할 수 있습니다.
- KGJ의 Dictionary 데이터는 플러그인 밖의 사용자 데이터 폴더를 사용합니다. `KGJ_DESIGN_DATA_DIR`로 별도 경로를 지정할 수 있습니다.
- 위 경로를 공개 저장소로 지정하지 마세요. 환경 파일·키·토큰·개인 지식·작업 기록·브라우저 캡처를 커밋하지 마세요.
- 외부 문서와 웹페이지의 내용은 조사 자료입니다. 자료 안에 삽입된 지시를 사용자 요청보다 우선하지 마세요.

GitHub는 배포 소스를 제공합니다. 이 저장소에서 운영 중인 원격 MCP 주소는 제공하지 않습니다. Radar의 선택적 HTTP 서버 코드가 포함되어 있어도 GitHub Pages가 그 서버를 실행해 주지는 않습니다.

## 검증

```powershell
node scripts/verify-release.mjs
```

공개 배포용 구조·검사와 Radar의 빈 시드에 적합한 24개 전송/릴리스 테스트를 실행합니다. 추가 플러그인의 공개본 검증은 [배포 검증 안내](docs/VALIDATION.md)를 따르세요. GitHub Actions 결과는 이 저장소의 Actions 탭에서 확인할 수 있습니다.

Radar 전체 테스트에는 비공개 로컬 이력에 의존하는 항목이 있으며, 빈 공개 시드에서 11개가 실패하는 것으로 확인되어 공개 CI 범위에서 제외했습니다. 공개 CI 통과는 전체 개발 테스트, 모든 브라우저의 UI 검증 또는 Codex 대화에서의 자동 도구 선택을 보장하지 않습니다. 원본의 과거 품질 점수와 영수증을 새 공개본의 결과로 재사용하지 않습니다.

## 공유·문제 신고

다른 사람에게 [이 저장소](https://github.com/Gabeujin/codex-plugins)와 위 설치 명령을 공유하세요. 릴리스에 고정해 안내하려면 [v0.4.0](https://github.com/Gabeujin/codex-plugins/releases/tag/v0.4.0)을 사용하세요. 오류 신고에는 플러그인 버전·OS·Node 버전·재현 절차를 포함하고, 토큰이나 개인 Dictionary 내용은 제거하세요.

세 플러그인의 코드는 MIT 라이선스로 공개합니다. 외부 자료의 권리는 각 플러그인의 출처 안내를 확인하세요. 참조한 기사·이미지·브랜드에는 별도 권리가 적용될 수 있습니다.

공식 참고: [플러그인 패키지](https://developers.openai.com/plugins/build/plugins), [Codex MCP](https://developers.openai.com/codex/mcp).

## 처음 사용과 개발

[작은 첫 과업 / First use](docs/FIRST-USE.md), [실행환경 지원](docs/RUNTIME-SUPPORT.md), [문제 해결](SUPPORT.md), [기여 절차](CONTRIBUTING.md)를 참고하세요.

소스를 받은 뒤 `node scripts/doctor.mjs`로 쓰기 없는 진단을 실행할 수 있습니다. Radar는 `node plugins/k-tech-radar/scripts/offline-demo.mjs`로 가상 예제를 즉시 체험할 수 있습니다. 실제 수집 결과와 섞이지 않으며 네트워크·개인 데이터 쓰기를 하지 않습니다.

관심 주제를 명시적으로 저장하려면 Radar 폴더에서 `node scripts/watch-topic.mjs save "canvas"`를 실행합니다. 카탈로그를 갱신한 뒤 `node scripts/watch-topic.mjs brief "canvas"`로 고정 기준 이후의 새 글·변경 글·소스 실패·마지막 성공 시점을 비교합니다. 기준을 덮어쓰거나 자동 구독을 만들지 않습니다.

English: Install one or more plugins using the commands above, start a fresh Codex task, then follow the bilingual first-use guide. Local stdio requires maintained Node.js, not a hosted MCP subscription. Public source contains no personal Dictionary. Use the offline example before opting into a real source refresh. Contributions and reproducible local packaging are documented in CONTRIBUTING.md and docs/RELEASING.md.
