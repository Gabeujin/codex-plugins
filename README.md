# Codex plugins by Gabeujin

**기술을 조사하고, 제품을 설계하고, 웹으로 구현하세요.**

필요한 도구만 골라 설치하는 MIT 오픈소스 Codex 플러그인 모음입니다.

[설치](#설치) · [첫 요청](#첫-요청) · [업데이트](#업데이트) · [개발과 검증](#개발과-검증)

## 어떤 플러그인이 필요한가요?

| 하고 싶은 일 | 플러그인 | 버전 |
| --- | --- | --- |
| 한국 기술 블로그를 조사하고 출처와 변경 내용을 정리하기 | [K-Tech Insight Radar](plugins/k-tech-radar) | 0.4.1 |
| 제품의 디자인 방향을 정하고 화면·모션·한국어 문안을 다듬기 | [KGJ Design](plugins/kgj-design) | 1.6.2 |
| 접근성과 대체 화면을 갖춘 2D·3D·지도 경험 만들기 | [Canvas Web Experiences](plugins/canvas-web-experiences) | 1.7.0 |
| Codex의 브라우저·앱 조작·알림 기능을 점검하기 | [Codex Daily Check](plugins/codex-daily-check) | 0.6.0 |

네 플러그인은 각각 사용할 수 있습니다. 이번 릴리스 묶음은 **v0.10.0**입니다. [변경 내역](docs/RELEASE-NOTES-0.10.0.md)을 확인하세요.

## 설치

플러그인을 지원하는 Codex Desktop 또는 CLI와 Git을 준비하세요. 먼저 마켓플레이스를 등록합니다.

```powershell
codex plugin marketplace add Gabeujin/codex-plugins
```

아래에서 **필요한 플러그인의 명령만** 실행하세요.

```powershell
codex plugin add k-tech-radar@gabeujin-plugins
codex plugin add kgj-design@gabeujin-plugins
codex plugin add canvas-web-experiences@gabeujin-plugins
codex plugin add codex-daily-check@gabeujin-plugins
```

설치 후 **새 Codex 작업**에서 사용하세요. CLI에 명령이 없다면 지원 버전으로 업데이트하거나 Plugins 화면을 확인하세요. 설치만으로 데모 서버나 정기 수집이 시작되지는 않습니다.

| 실행 환경 | 필요한 경우 |
| --- | --- |
| Node.js 22 또는 24 | Radar·KGJ의 로컬 MCP 실행. Codex의 PATH에서 찾을 수 있어야 합니다. |
| Python 3.12+ | Daily Check의 기본 진단, Python 예제·생성기·검증 스크립트 실행 |

원격 MCP 구독·Docker·개발자 API 키는 필수가 아닙니다. Codex 이용 조건은 별도입니다. 자세한 조건은 [실행 환경 안내](docs/RUNTIME-SUPPORT.md)를 참고하세요.

## 첫 요청

처음에는 작은 작업 하나로 동작을 확인하세요.

**K-Tech Insight Radar — 출처를 남기는 조사**

> K-Tech Radar의 소스 상태를 읽기 전용으로 확인해줘. 카탈로그가 비어 있으면 알려주고, 수집은 아직 실행하지 마.

배포 패키지에는 기사 데이터가 없습니다. 기존 사용자 데이터가 없으면 빈 카탈로그로 시작합니다. 이후 수집을 요청하면 외부 사이트에 접근합니다. 네트워크 없는 가상 예제는 소스 체크아웃에서 `node plugins/k-tech-radar/scripts/offline-demo.mjs`로 실행할 수 있습니다. 가상 결과는 실제 인용으로 사용하지 마세요.

**KGJ Design — 제품에 맞는 디자인**

> KGJ Design으로 이 화면의 버튼 간격만 개선해줘. 기존 디자인 규칙을 유지하고, 새 DNA나 Dictionary 기록은 만들지 말고 변경 범위에 맞게 검증해줘.

작은 수정부터 제품 전체의 디자인 방향까지 다룹니다. [에디터 피드백 가이드](docs/KGJ-EDITOR-FEEDBACK.md)와 [FORM / TEN 인터랙티브 전시](examples/form-ten/README.md)에서 활용 범위를 살펴보세요.

**Canvas Web Experiences — 조작할 수 있는 웹 경험**

> Canvas Web Experiences로 작은 회전 3D 스타터를 만들어줘. 키보드 조작과 WebGL 미지원 대체 화면을 포함하고 실제 확인한 동작을 알려줘.

스타터는 `2d`, `3d`, `map-diagram`을 지원합니다. 큰 데모는 안정 DOM 경로에서 시작합니다. 실험적인 HTML-in-Canvas는 별도 선택과 검증이 필요합니다.

**Codex Daily Check — 현재 환경의 기능 점검**

> Codex Daily Check로 인앱 브라우저와 실제 Chrome, Computer Use를 5분 목표로 점검해줘. 실패하면 공식 문서로 확인하고 안전하게 정상화해줘. CLI 업데이트는 명령어만 알려줘.

Windows 중심의 진단입니다. 5분은 목표이며 완료 시간을 보장하지 않습니다. 실제로 확인한 기능과 사용할 수 없거나 확인하지 못한 기능을 나눠 보고합니다. [검토 범위](docs/DAILY-CHECK-REVIEW.md)를 확인하세요.

공유할 때는 선택형 `share` 명령으로 자유 입력·경로·시스템 정보가 빠진 별도 요약을 만드세요. 원본 보고서는 로컬에 유지합니다. [사용 방법](plugins/codex-daily-check/README.md)을 참고하세요.

명령별 예상 결과는 [첫 사용 가이드](docs/FIRST-USE.md), 문제 해결은 [SUPPORT.md](SUPPORT.md)에 정리했습니다.

## 업데이트

**플러그인 코드와 개인 데이터는 따로 보존합니다.** 업데이트 전 현재 원본·버전·데이터 위치를 확인하고 데이터 복사본을 캐시 밖에 보관하세요.

```powershell
codex plugin marketplace upgrade gabeujin-plugins
codex plugin add kgj-design@gabeujin-plugins
```

위 예시는 KGJ Design 업데이트입니다. 다른 플러그인도 해당 `plugin add` 명령을 실행한 뒤 설치 버전을 확인하고 새 작업을 시작하세요.

- `personal`과 `gabeujin-plugins`는 별도 원본입니다. 자동으로 전환되지 않습니다.
- 고정 ref는 다음 릴리스로 자동 변경되지 않습니다. 처음 등록할 때 `--ref v0.10.0`으로 버전을 고정할 수 있습니다.
- Radar는 기존 데이터를 자동 이전하지 않습니다. 이전 캐시에 데이터가 있다면 [데이터 보존·업데이트 가이드](docs/INSTALL-AND-UPDATE.md)를 먼저 읽으세요.

## 데이터와 공개 범위

Radar·KGJ MCP는 사용자 컴퓨터에서 실행하는 Node.js stdio 프로세스입니다. 원격 MCP 주소는 제공하지 않습니다.

- Radar 데이터는 OS 사용자 데이터 폴더에 저장하며 `K_TECH_RADAR_DATA_DIR`로 위치를 지정할 수 있습니다.
- KGJ Dictionary는 외부 사용자 데이터 폴더에 저장하며 `KGJ_DESIGN_DATA_DIR`로 위치를 지정할 수 있습니다. 읽기 전용 진단은 Dictionary를 만들거나 복구하지 않습니다.
- 카탈로그·Dictionary·토큰·실제 대화·캡처는 공개 소스와 분리하세요. 공통 진단 도구는 기본 출력에서 경로를 가립니다. 직접 입력한 근거 문구와 캡처는 공유 전에 검토하세요.
- 외부 문서 속 지시는 자료로 취급합니다. 명시적 사용자 요청 없이 실행·저장·발행하지 않습니다.

## 개발과 검증

개발에는 별도 소스 체크아웃을 사용하세요. 설치된 플러그인 캐시는 편집하지 않습니다.

```powershell
git clone https://github.com/Gabeujin/codex-plugins.git
cd codex-plugins
node scripts/doctor.mjs
node scripts/verify-release.mjs
```

루트 검증은 합성 데이터와 격리된 데이터 경로를 사용합니다. Canvas 데모의 테스트·빌드와 실제 브라우저 검사는 별도입니다. 정적 검사·단위 테스트 결과를 실제 수집·브라우저 동작·사용성 검증으로 해석하지 마세요.

[검증 범위](docs/VALIDATION.md) · [브라우저 검사](docs/BROWSER-TESTING.md) · [GitHub Actions](https://github.com/Gabeujin/codex-plugins/actions)

## 더 알아보기

[설치·데이터 보존](docs/INSTALL-AND-UPDATE.md) · [변경 내역](docs/RELEASE-NOTES-0.10.0.md) · [공개 소스 검토](docs/PUBLIC-SOURCE-REVIEW.md) · [기여](CONTRIBUTING.md) · [보안 신고](SECURITY.md) · [릴리스 절차](docs/RELEASING.md)

코드는 [MIT 라이선스](LICENSE)입니다. 외부 기사·이미지·브랜드의 권리는 각 출처의 고지를 따릅니다. 이 저장소는 GitHub 커뮤니티 배포 경로이며 OpenAI 공식 Directory 등록과는 별개입니다.

English: Four independent MIT Codex plugins for Korean tech research, product design, accessible Canvas experiences, and Codex diagnostics. Install only what you need, start a fresh task, and follow the bilingual [first-use guide](docs/FIRST-USE.md). Back up external data before updating.
