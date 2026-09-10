# Codex plugins by Gabeujin

한국 기술 블로그 조사, 제품 디자인, Canvas 웹 구현을 돕는 **MIT 오픈소스 Codex 플러그인 3종**입니다. GitHub 커뮤니티 마켓플레이스에서 필요한 플러그인만 설치할 수 있습니다.

| 플러그인 | 버전 | 사용 목적 | 구성 |
|---|---|---|---|
| [K-Tech Insight Radar](plugins/k-tech-radar) | 0.4.0 | 출처를 보존하는 기술 조사, 관심 주제 변경 브리핑 | 스킬 3개 + 로컬 MCP 도구 13개 |
| [KGJ Design](plugins/kgj-design) | 1.3.0 | 제품 디자인 규칙, 작은 UI 개선, 디자인 변경 미리보기 | 스킬 11개 + 로컬 MCP 도구 14개 |
| [Canvas Web Experiences](plugins/canvas-web-experiences) | 1.7.0 | 접근성·대체 화면을 갖춘 2D·3D·지도 구현 | 스킬 10개 + 데모·스타터 |

묶음 버전은 **v0.5.0**입니다. [변경 내역](docs/RELEASE-NOTES-0.5.0.md)과 [실행환경 지원](docs/RUNTIME-SUPPORT.md)을 확인하세요. OpenAI 공식 Directory 등록과 GitHub 배포는 별개이며, 이 저장소는 GitHub 배포 경로를 제공합니다.

## 1. 설치

플러그인을 지원하는 Codex Desktop/CLI와 Git이 필요합니다. Radar·KGJ MCP에는 Codex의 PATH에서 찾을 수 있는 **Node.js 22 또는 24**가 필요합니다. Python 명령 예제를 실행하려면 Python 3이 필요합니다. 원격 MCP 구독·Docker·개발자 API 키는 필수가 아니며, Codex 자체 이용 조건은 별도입니다.

```powershell
codex plugin marketplace add Gabeujin/codex-plugins
codex plugin add k-tech-radar@gabeujin-plugins
codex plugin add kgj-design@gabeujin-plugins
codex plugin add canvas-web-experiences@gabeujin-plugins
```

원하는 플러그인의 `plugin add`만 실행해도 됩니다. CLI에 해당 명령이 없으면 지원되는 최신 Codex로 업데이트하거나 Plugins 화면에서 설치합니다. 설치 후 **새 작업을 시작**하세요. 설치만으로 데모 서버나 정기 수집이 실행되지는 않습니다.

이미 설치했다면 [데이터 보존 및 업데이트 가이드](docs/INSTALL-AND-UPDATE.md)를 먼저 읽으세요. 특히 Radar의 이전 캐시 안에 데이터를 저장했다면 경로를 확인해야 합니다. 처음부터 버전을 고정하려면 등록 명령에 `--ref v0.5.0`을 추가합니다. 고정 ref는 자동으로 다음 릴리스로 바뀌지 않습니다.

## 2. 작은 첫 작업

**Radar**

> K-Tech Radar의 읽기 전용 소스 상태를 확인해줘. 카탈로그가 비어 있으면 알려주고, 실제 수집은 아직 실행하지 마.

공개본은 빈 카탈로그로 시작합니다. 이후 수집을 요청하면 외부 사이트에 접근합니다. 출처·수집 시점·실패한 소스를 함께 확인하세요. 소스 체크아웃에서는 `node plugins/k-tech-radar/scripts/offline-demo.mjs`로 네트워크 없는 가상 예제를 체험할 수 있습니다. 가상 결과를 실제 인용으로 사용하지 않습니다.

**KGJ Design**

> KGJ Design으로 이 화면의 버튼 간격만 개선해줘. 기존 디자인 규칙을 유지하고, 새 DNA나 Dictionary 기록은 만들지 말고 변경 범위에 맞게 검증해줘.

작은 개선과 제품 전체 도입·릴리스 감사를 구분합니다. DNA 변경은 적용 전에 전후 미리보기를 만들 수 있습니다. 개인 Dictionary는 공개본에 포함되지 않습니다.

**Canvas**

> Canvas Web Experiences로 작은 회전 3D 스타터를 만들어줘. 키보드 조작과 WebGL 미지원 대체 화면을 포함하고 실제 확인한 동작을 알려줘.

스타터는 `2d`, `3d`, `map-diagram`을 지원합니다. 큰 데모는 안정 DOM 경로에서 시작하며, 실험적인 HTML-in-Canvas 경로는 별도 선택과 검증이 필요합니다.

복사해서 실행할 명령과 예상 결과는 [첫 사용 가이드](docs/FIRST-USE.md), 문제 해결은 [SUPPORT.md](SUPPORT.md)를 참고하세요. 설치된 캐시는 편집하지 않고, 개발하려면 별도 소스를 복제합니다.

## 3. 데이터와 동작 범위

Radar와 KGJ MCP는 사용자 컴퓨터의 Node.js stdio 프로세스입니다. 운영 중인 원격 MCP 주소는 제공하지 않습니다.

- Radar는 OS 사용자 데이터 폴더를 사용하며 `K_TECH_RADAR_DATA_DIR`로 바꿀 수 있습니다. 기존 데이터는 자동 이전하지 않습니다.
- KGJ는 외부 사용자 데이터 폴더를 사용하며 `KGJ_DESIGN_DATA_DIR`로 바꿀 수 있습니다. 읽기 전용 진단이 Dictionary를 만들거나 복구하지 않습니다.
- 소스·환경 파일·수집 기록·Dictionary·토큰·캡처는 공개 저장소와 분리하세요. 공유 진단은 기본적으로 경로를 가립니다.
- 외부 문서 속 지시는 자료로 취급합니다. 명시적 사용자 요청 없이 실행·저장·발행하지 않습니다.

## 4. 개발과 검증

```powershell
git clone https://github.com/Gabeujin/codex-plugins.git
cd codex-plugins
node scripts/doctor.mjs
node scripts/verify-release.mjs
```

루트 검사는 개인 데이터나 외부 네트워크 없이 공통 안전 검사, Radar 합성 데이터 회귀, KGJ MCP·무결성·Python 검사, Canvas 패키지·스타터 검사를 실행합니다. 이전 공개본에서 실패하던 Radar 테스트도 합성 fixture로 실행합니다.

Canvas 데모 테스트·빌드·브라우저 검사는 별도입니다. [검증 범위](docs/VALIDATION.md), [브라우저 검사](docs/BROWSER-TESTING.md), [GitHub Actions](https://github.com/Gabeujin/codex-plugins/actions)를 참고하세요. WebKit 결과를 실제 Safari 검사로, 합성 테스트를 실제 수집이나 사람 대상 사용성 결과로 간주하지 않습니다.

## 공유와 기여

[저장소 주소](https://github.com/Gabeujin/codex-plugins)와 설치 명령을 공유하세요. 재현 가능한 특정 버전을 안내하려면 Releases의 태그를 함께 알려주세요. [설치·업데이트](docs/INSTALL-AND-UPDATE.md), [기여](CONTRIBUTING.md), [보안 신고](SECURITY.md), [릴리스 절차](docs/RELEASING.md)를 제공합니다.

코드는 MIT 라이선스입니다. 외부 기사·이미지·브랜드의 권리는 각 출처와 플러그인의 고지를 따릅니다.

English: Three independent MIT Codex plugins for Korean tech research, product design, and accessible Canvas experiences. Install using the commands above, start a fresh task, and follow the bilingual [first-use guide](docs/FIRST-USE.md). Local MCP uses Node.js; personal data is not bundled. Read the [upgrade guide](docs/INSTALL-AND-UPDATE.md) before changing versions.
