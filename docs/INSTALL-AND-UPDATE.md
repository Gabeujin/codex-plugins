# 설치·업데이트·데이터 보존

명령은 Codex CLI 0.153.4의 도움말을 확인해 작성했습니다. Desktop과 CLI의 기능 제공 시점은 다를 수 있습니다. 플러그인 사용에는 저장소 복제가 필요하지 않으며, 스크립트 개발·테스트에는 별도 체크아웃을 사용합니다.

## 새 설치

```powershell
codex plugin marketplace add Gabeujin/codex-plugins
codex plugin add k-tech-radar@gabeujin-plugins
codex plugin add kgj-design@gabeujin-plugins
codex plugin add canvas-web-experiences@gabeujin-plugins
```

세 add 명령 중 필요한 것만 실행합니다. 설치 후 새 Codex 작업에서 플러그인 이름을 명시해 작은 과업을 요청하세요. `personal` 원본과 `gabeujin-plugins`는 별개입니다. 같은 플러그인을 둘 다 설치했다면 Plugins 화면에서 이번 작업에 사용할 원본을 확인하세요.

## 기존 사용자 업데이트

1. 진행 중인 MCP 작업을 마치고 현재 플러그인 버전과 데이터 위치를 확인합니다. 소스 체크아웃의 `node scripts/doctor.mjs`는 기본적으로 경로를 가립니다. `--private-paths`는 로컬에서만 확인하고 출력은 공유하지 않습니다.
2. 데이터 폴더의 복사본을 저장소·캐시 밖에 보관합니다. 플러그인 코드의 업데이트와 사용자 데이터 이전은 별개입니다. 기존 폴더를 삭제하지 않습니다.
3. 고정 ref가 아닌 Git marketplace의 소스 snapshot을 갱신합니다.

```powershell
codex plugin marketplace upgrade gabeujin-plugins
codex plugin add k-tech-radar@gabeujin-plugins
codex plugin add kgj-design@gabeujin-plugins
codex plugin add canvas-web-experiences@gabeujin-plugins
```

`marketplace upgrade`는 소스 갱신 명령입니다. 이어서 필요한 plugin add를 실행하고 결과의 설치 버전을 확인합니다. 버전이 그대로라면 고정 ref 및 marketplace 원본을 확인하세요. 자동 삭제·강제 재설치를 해결책으로 사용하지 않습니다. 새 작업을 시작한 뒤 읽기 전용 상태 확인을 먼저 실행하세요.

## Radar 0.4.0 데이터 경로 변화

명시적 `K_TECH_RADAR_DATA_DIR`가 가장 우선합니다. 지정하지 않으면 Windows는 LOCALAPPDATA 아래 `KTechRadar/data`, macOS는 사용자 `Library/Application Support/KTechRadar/data`, Linux는 XDG_DATA_HOME 아래 `k-tech-radar`를 사용합니다. XDG_DATA_HOME이 없으면 사용자 `.local/share`가 기준입니다.

이전 개발 체크아웃이나 사용자 지정 CODEX_HOME의 플러그인 내부에 데이터가 있었다면 새 기본 경로에서는 빈 카탈로그로 보일 수 있습니다. 기존 데이터가 지워졌다고 단정하지 마세요. 이전 위치와 무결성을 확인하고, 백업한 전체 데이터 폴더를 캐시 밖의 전용 위치에 복사한 뒤 그 위치를 환경 변수로 선택합니다. 임의로 일부 JSON만 합치지 않습니다. 플러그인은 자동 이전하지 않습니다. Codex를 실행하는 환경에 변수를 설정하고 새 프로세스에서 반영을 확인하세요.

`K_TECH_RADAR_USE_BUNDLED_DATA=1`은 의도적인 개발용 예외입니다. 일반 설치의 데이터 보존 방법으로 권장하지 않습니다.

## KGJ와 rollback

읽기에서 무결성 오류가 나면 데이터 디렉터리를 지우거나 빈 JSON으로 바꾸지 않습니다. 백업을 유지하고 KGJ의 verify/recover 안내를 따릅니다. recover는 불변 이력이 유효할 때만 명시적으로 실행합니다.

```text
python -X utf8 -B scripts/check-data-compatibility.py current-release-manifest.json target-release-manifest.json kgj-design
```

스키마가 같아도 무결성·재생 검사가 필요합니다. 스키마가 다르거나 이전 릴리스에 필요한 선언이 없으면 도구가 차단합니다. 코드만 과거 버전으로 바꾸는 것은 데이터 복구가 아닙니다.

## 버전 고정과 ZIP

처음 등록할 때 `codex plugin marketplace add Gabeujin/codex-plugins --ref v0.5.0`으로 고정할 수 있습니다. 고정 태그는 upgrade해도 다음 태그로 바뀌지 않습니다. 이미 등록된 원본을 바꿀 때는 CLI 도움말과 현재 설정을 확인하고 변경 전 데이터를 보존하세요.

릴리스 ZIP은 테스트한 소스와 `release-manifest.json`을 담습니다. 새 폴더에 풀고 `codex plugin marketplace add <압축을-푼-폴더>`로 로컬 소스를 등록할 수도 있습니다. npm 의존성·빌드 산출물·개인 데이터는 들어 있지 않습니다. ZIP 검증은 해당 커밋이 있는 체크아웃에서 `python -X utf8 -B scripts/package-release.py --check <ZIP>`으로 실행합니다.

English: Refresh the marketplace snapshot, install the desired plugin version, and start a new task. Back up external data first. A pinned tag stays pinned. Radar does not migrate old bundled data automatically; select a verified external data folder explicitly. Unknown or incompatible schemas block automatic rollback.
