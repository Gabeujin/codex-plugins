# Session Status

**작업 상태를 채팅 제목에서 바로 확인하세요.**

Codex App·CLI의 로컬 작업 제목에 `[Working]`, `[Needs review]`, `[Committed]` 같은 상태를 붙이는 작은 MIT 플러그인입니다. 한국어와 사용자 정의 상태도 지원합니다.

```text
[작업중] 예제 개선 → [검토대상] 예제 개선 → [확인완료] 예제 개선
```

## 설치와 첫 사용

```powershell
codex plugin marketplace add Gabeujin/codex-plugins
codex plugin add session-status@gabeujin-plugins
```

Node.js 22 또는 24가 Codex의 PATH에 있어야 합니다. 새 작업에서 플러그인을 사용하고 CLI의 `/hooks`, 또는 App의 **Review hooks / Settings > Hooks**에서 `SessionStart`와 `UserPromptSubmit`을 검토·신뢰하세요. 이벤트를 선택하고 Enter를 누르면 개별 hook을 볼 수 있습니다. 기존 실행 세션에 즉시 재적재됐다고 가정하지 마세요.

> Session Status로 현재 채팅 제목에 실제 작업 상태를 표시해 줘. 주제는 유지하고 커밋·배포·테스트 완료는 결과를 확인한 경우에만 표시해 줘.

아직 제목이 없는 새 채팅에서는 Codex의 native 제목 도구로 짧은 주제와 상태를 함께 지정합니다. 그 도구도 없으면 제목을 먼저 지정한 뒤 다시 요청하세요.

## 포함된 기능

| 구성 | 역할 |
| --- | --- |
| `session-status` skill | 상태 선택, 사용자 언어, 완료 근거와 제목 보존 규칙 |
| `get_session_title` | 명시한 로컬 세션의 제목만 읽기 |
| `preview_session_status` | 제목 변경 미리보기, 읽기·쓰기 없음 |
| `set_session_status` | 이전 제목을 대조하고 상태 교체 후 정확히 재조회 |
| 두 lifecycle hooks | 현재 세션 ID와 상태 규칙을 에이전트에게 전달 |

Hook이 업무 내용을 분류하거나 제목을 직접 강제하지는 않습니다. 에이전트가 실제 결과를 확인한 뒤 tool로 갱신합니다. 기존 상태는 교체하고 `[Example]` 같은 프로젝트 태그는 보존합니다. 사용자 정의 이전 상태는 `previous_status`로 알려 주세요.

## 실행과 개인정보

MCP는 로컬 Node stdio 프로세스이며 외부 의존 패키지·API 키가 필요 없습니다. 제목 읽기·쓰기는 로컬 `codex app-server --stdio`의 `thread/read`·`thread/name/set`을 사용합니다. 이 실험적 API가 없는 버전에서는 native 제목 도구를 사용하거나 미지원으로 안내합니다. Codex 실행 파일을 찾지 못하면 MCP 실행 환경에 `SESSION_STATUS_CODEX_BIN`을 native 실행 파일의 절대 경로로 지정할 수 있습니다. Codex 자체는 기존 인증·설정을 사용하며, 이 플러그인은 로그인이나 모델 요청을 시작하지 않습니다.

플러그인은 외부 네트워크 전송, 텔레메트리, 별도 상태 저장소, transcript 파일 읽기, 전역 설정 변경을 구현하지 않습니다. Hook 입력 중 이벤트와 세션 ID만 사용하며 prompt와 transcript 경로는 출력하거나 저장하지 않습니다. 선택한 세션의 제목과 ID는 로컬 tool 응답 및 일반적인 Codex 대화 기록에 나타날 수 있습니다. 제목에는 비밀이나 개인 정보를 쓰지 마세요. Codex 자체의 데이터 처리 정책은 별도입니다.

기존 전역 상태 hook이 있다면 중복 지침이 생길 수 있습니다. 플러그인이 기존 설정을 바꾸지는 않으므로 `/hooks`에서 사용할 쪽을 선택하세요. Herdr에서 실행된 **Codex 채팅 제목**에도 같은 규칙을 사용할 수 있으나 Herdr 패널·Hermes·다른 에이전트의 이름은 변경하지 않습니다.

## 검증과 한계

```text
node --test plugins/session-status/tests/*.test.mjs
```

합성 제목·모의 Codex API·실제 stdio MCP의 초기화와 tool 호출을 검사합니다. 테스트는 실제 사용자 세션을 읽거나 바꾸지 않습니다. 제목 대조는 낡은 요청을 거부하지만 별도 클라이언트가 쓰기 직전에 동시에 변경하는 경쟁을 원자적으로 막지는 못합니다. 완료 라벨은 작업 성공의 인증서가 아닙니다. 자동 skill 선택과 UI 반영은 Codex 버전·권한·hook 신뢰 상태에 영향을 받습니다.

설치 방식은 [공식 플러그인 문서](https://developers.openai.com/plugins/build/plugins), hook 검토는 [공식 hook 문서](https://learn.chatgpt.com/docs/hooks)를 참고하세요. GitHub 커뮤니티 배포이며 OpenAI 공식 Directory 등록을 뜻하지 않습니다.

English: A local-only skill, three MCP tools and two lifecycle context hooks for evidence-based chat status prefixes. Hooks remind the agent; the agent selects the label and performs a verified title update. No task completion is inferred from a stopped turn.
