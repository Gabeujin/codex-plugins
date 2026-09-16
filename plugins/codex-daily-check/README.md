# Codex Daily Check

Windows 중심의 Codex 기능 점검 스킬입니다. 기본 실행, 실제 브라우저 제어, Computer Use, 사용자 알림·응답, CLI 버전 차이를 **5분 목표**로 확인합니다. 검증되지 않은 기능을 정상으로 표시하지 않습니다.

## 설치와 호출

```powershell
codex plugin marketplace add Gabeujin/codex-plugins
codex plugin add codex-daily-check@gabeujin-plugins
```

설치 후 새 작업에서 `$codex-daily-check`를 호출하세요. `daliy check` 표현도 검색 설명에 포함했습니다.

> Codex 기능을 5분 안에 점검해 줘. 인앱 브라우저와 실제 Chrome을 각각 확인하고, 설치된 Computer Use는 실제 앱에 입력해 봐. 실패하면 공식 문서에 따라 안전하게 정상화해 줘. CLI 업데이트는 명령어만 알려줘.

진단만 원하는 경우에는 “복구나 설정 변경 없이 진단만”이라고 요청합니다. 설치 자체는 점검·알림·업데이트·정기 작업을 실행하지 않습니다.

## 판정 범위

- 기본 명령 실행과 UTF-8 한글 파일 재읽기
- 인앱 브라우저와 실제 Chrome 각각 읽기·링크 이동·입력값 재읽기
- 설치된 Computer Use의 실제 앱 실행·화면 읽기·입력 결과 확인
- Windows NotifyIcon 알림과 플러그인 자체 WinForms 입력 창
- Codex 질문 카드 응답과 실제 승인 흐름을 별도 기록
- Desktop·내장 CLI·별도 CLI 버전 구분, 최신 안정 npm 배포와 비교
- 이전 실행 대비 도구 추가·변경·사라짐 및 통과 항목의 회귀

Windows 테스트 창은 Codex 자체 승인 알림이 아닙니다. 응답이 없으면 UNVERIFIED로 남기며, 입력 코드가 어떤 작업에도 권한을 부여하지 않습니다. 실제 승인 검증은 정당한 작업에서 승인 필요 상황이 발생하고 사용자가 직접 응답했을 때만 가능합니다.

## 5분 진단과 복구

240초부터 새 검사를 시작하지 않고 300초까지 결과를 정리합니다. 호스트 호출이 멈추면 초과할 수 있으며 실제 시간을 표시합니다. 시간 초과는 전체 READY로 표시하지 않습니다. 전체 5분 완료에 대한 보편적 SLA나 모든 OS 실동작 인증은 제공하지 않습니다.

설치된 기능의 실패는 즉시 남깁니다. 사용자가 정상화를 요청했다면 별도 복구 단계에서 공식 문서를 확인하고 승인 범위의 안전한 수정을 진행합니다. 같은 실제 동작이 재통과해야 정상화로 기록합니다. 사용자 앱 강제 종료, 권한 완화, 캐시 삭제를 자동으로 실행하지 않습니다.

CLI 업데이트는 항상 **명령어 안내만** 합니다. npm 설치가 확인되고 최신 안정 버전보다 오래됐을 때만 `npm install -g @openai/codex@latest`를 제시합니다. 점검기가 CLI를 업데이트하거나 Desktop을 종료·재시작하지 않습니다. 최신 정보 조회 실패는 UNKNOWN이며, 별도 CLI 업데이트로 Desktop 내장 CLI까지 갱신됐다고 판단하지 않습니다.

## 실행환경·데이터

Python 3.12+ 표준 라이브러리를 사용합니다. Windows native 점검에는 Windows PowerShell/WinForms와 활성 데스크톱이 필요합니다. Chrome에는 해당 프로필의 연결된 브라우저 확장이 필요합니다. Codex 도구 노출 여부는 앱 버전과 정책에 따라 달라집니다. Python 논리 테스트의 다른 OS 통과는 그 OS의 GUI 검증을 의미하지 않습니다.

`report.py start --root <run-store>`로 설치 캐시 외부의 저장 폴더를 선택합니다. CLI 래퍼는 선택 사항이며 `probe.py --cli-wrapper <path>`로 지정할 수 있습니다. 호스트에서 지원하는 전용 fresh-session 래퍼가 있다면 이를 사용합니다. 기본 `probe.py`는 오프라인이며 `--check-latest`에서만 공개 npm 메타데이터를 읽습니다. 패키지를 다운로드하거나 설치하지 않습니다.

보고서는 새 파일로 생성하고 자동 삭제하지 않습니다. 원본 probe 결과에는 로컬 설치 경로가 포함될 수 있으므로 공유하지 마세요. 최종 보고서는 시스템 버전 필드만 추려 담지만 호출자가 작성한 근거 문구는 공유 전 별도로 검토해야 합니다. 보고서는 **호출자가 기록한 관찰의 집계**이며 독립 인증이나 변조 방지 감사 기록이 아닙니다. 실제 운영 기록·토큰·스크린샷·개인 환경 파일은 배포하지 않습니다.

## 검증

```powershell
python -X utf8 -B -m unittest discover -s tests -v
```

테스트 fixture는 OS 임시 폴더에 보존하며 설치 캐시를 변경하지 않습니다. 공개 CI는 네트워크·실제 GUI·사람 응답 없이 논리를 검사합니다. 실제 Chrome, 인앱 브라우저, 메모장 입력·파일 재읽기는 작성자의 Windows 환경에서 별도로 확인했습니다. 새 PC에서는 다시 실제 점검해야 합니다.

공식 문서: [Computer Use](https://learn.chatgpt.com/docs/computer-use), [Chrome 연결·복구](https://learn.chatgpt.com/docs/chrome-extension), [CLI 설치·업데이트](https://developers.openai.com/codex/cli/).

English: A Windows-first, evidence-conscious Codex readiness skill. Tests the in-app browser and external Chrome separately, requires actual native app actions when Computer Use is installed, separates notification response from approval, and only suggests CLI update commands. Five minutes is a measured target, not a guaranteed SLA. Receipts are caller-reported observations, not independent attestations. No private runtime data is shipped. MIT licensed.
