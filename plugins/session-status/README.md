# Session Status

**작업 상태와 연결된 채팅을 제목에서 바로 확인하세요.**

Codex App·CLI의 로컬 작업 제목에 `[Working]`, `[Needs review]`, `[Committed]` 같은 상태를 붙이는 작은 MIT 플러그인입니다. 한국어와 사용자 정의 상태도 지원합니다.

```text
[작업중][가] 예제 개선
[작업중][가-가] 소스 분석
[작업중][가-나] 데이터 검토
[확인완료][가-가-가] 검증 결과
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
| `register_session_lineage` / `get_session_lineage` | 명시한 host·세션의 안정된 한글 계층 ID와 자식·보고 상태 관리 |
| `recommend_session_model` | 현재 모델 목록과 공식 작업별 안내를 대조한 권고. Astra는 필요성을 기록한 예외로만 선택 |
| `prepare_parent_report` / `mark_parent_report` | 검증된 결과의 보고 문안·중복·전송 상태 관리. 실제 발송은 허가된 host 도구 사용 |
| `prepare_model_choice` / `resolve_model_choice` / `get_model_choice` | 작업·목적지·추천에 묶인 Y/N 질문과 실제 인간 응답 기록. Y는 추천 적용, N은 두 override 생략, 미응답은 대기 |
| 두 lifecycle hooks | 현재 세션 ID와 상태 규칙을 에이전트에게 전달 |

Hook이 업무 내용을 분류하거나 제목을 직접 강제하지는 않습니다. 에이전트가 실제 결과를 확인한 뒤 tool로 갱신합니다. 기존 상태는 교체하고 `[Example]` 같은 프로젝트 태그는 보존합니다. 사용자 정의 이전 상태는 `previous_status`로 알려 주세요.

## 하위 작업 생성과 결과 보고

사용자가 새 채팅을 요청하면 부모를 먼저 등록하고, 실제 새 thread ID를 받은 뒤 연결합니다. 루트 아래 3단계(가 → 가-가 → 가-가-가 → 가-가-가-가)까지 지원하며 프로젝트 태그와 상태를 보존합니다. 잘못된 부모·재부모화·깊이 초과는 거부합니다. 생성 대기 중인 clientThreadId를 실제 세션 ID로 사용하지 않습니다.

모델은 [공식 안내와 선택 지침](skills/session-status/references/model-selection.md)을 확인하고 목적·문맥·위험·현재 제공 조합을 대조합니다. Astra는 꼭 필요한 이유가 있을 때만 낮은 추론부터 검토합니다. 높은 추론 수준은 토큰·사용한도를 빠르게 소모할 수 있으므로 Astra의 추론은 low만 허용하고 자동 상향하지 않습니다. 모델을 제안할 때는 정확한 모델·추론·기본값을 보여주고 사용자에게 Y/N을 묻습니다. Y면 해당 추천을 적용하고, N이면 model·thinking을 모두 생략해 실제 기본값을 유지합니다. 미응답은 N으로 처리하지 않고 해당 채팅 생성을 기다립니다. 조건별 정책 채택만으로 개별 제안의 Y를 대신하지 않으며, 현재 host의 모델 지정 규칙도 유지합니다.

완료 시 하위 에이전트는 결과·검증·남은 제약을 짧게 작성하고, 인간이 직접 허가한 부모에게 native 메시지 도구로 보고한 뒤 발송 결과를 기록합니다. prepared는 문안 준비·미발송, sending은 전송 선점·결과 미확정, sent는 native 전송 응답 확인 완료를 뜻합니다. 이 플러그인 자체가 백그라운드에서 발송하거나 Stop을 완료로 해석하지는 않습니다. 전송 도구가 없거나 권한이 없으면 문안을 보존하고 미발송으로 안내합니다. native 메시지는 부모 작업을 깨우거나 다음 턴으로 예약할 수 있습니다. 전송 중 끊겼다면 보고 ID로 부모 기록을 확인하고 무조건 재발송하지 않습니다. 자세한 절차는 [skill](skills/session-status/SKILL.md)을 따릅니다.

모델 선택은 작업/revision·요청자·목적지와 추천/default 스냅샷에 묶입니다. 다른 작업이나 바뀐 추천에 이전 응답을 재사용하지 않습니다. 재개하면 get_model_choice로 상태를 읽고, 실제 생성 뒤 모델·추론 메타데이터도 대조합니다. 질문과 인간 응답의 근거는 에이전트가 확인하며 기록 도구 자체가 인간 신원을 인증하거나 모델을 실행하지 않습니다.

## 실행과 개인정보

MCP는 로컬 Node stdio 프로세스이며 외부 의존 패키지·API 키가 필요 없습니다. 제목 읽기·쓰기는 로컬 `codex app-server --stdio`의 `thread/read`·`thread/name/set`을 사용합니다. 이 실험적 API가 없는 버전에서는 native 제목 도구를 사용하거나 미지원으로 안내합니다. Codex 실행 파일을 찾지 못하면 MCP 실행 환경에 `SESSION_STATUS_CODEX_BIN`을 native 실행 파일의 절대 경로로 지정할 수 있습니다. Codex 자체는 기존 인증·설정을 사용하며, 이 플러그인은 로그인이나 모델 요청을 시작하지 않습니다.

플러그인 런타임은 외부 네트워크 전송, 텔레메트리, transcript 파일 읽기, 전역 설정 변경을 구현하지 않습니다. Hook 입력 중 이벤트와 세션 ID만 사용하며 prompt와 transcript 경로는 출력하거나 저장하지 않습니다. 선택한 세션의 제목과 ID는 로컬 tool 응답 및 일반적인 Codex 대화 기록에 나타날 수 있습니다. 제목에는 비밀이나 개인 정보를 쓰지 마세요. Codex 자체의 데이터 처리 정책은 별도입니다.

계층과 보고 상태는 기본적으로 CODEX_HOME/session-status/lineage.json에 저장합니다. SESSION_STATUS_DATA_DIR로 절대 경로를 지정할 수 있습니다. 세션 ID·host·부모·한글 ID·인간의 보고 허가 근거·보고 문안·전송 영수증을 저장하며, 선택 기능을 사용하면 작업 설명·목적지·추천/기본값·질문·Y/N 및 인간 응답 근거도 저장합니다. 변경 전 사본은 보존하며, 변경 전 사본과 잠금 기록은 같은 폴더의 history에 보존합니다. 제목·전체 프롬프트·transcript는 수집하지 않습니다. 보고에 입력한 문구와 링크는 이 로컬 저장소와 Codex 대화 기록에 남으므로 필요한 내용만 넣으세요. 여러 host가 독립 저장소를 사용하면 ID를 전역으로 조율하지 않으며, 같은 작업 가족은 하나의 registry 담당 host에서 관리합니다. 잠금·손상 오류를 저장소 초기화로 우회하지 않습니다.

0.1.x는 저장소가 없으며 0.2.0은 schemaVersion 1을 새로 만듭니다. 구버전으로 코드만 되돌리면 계층 기능과 보고 기능이 중지되며 기존 JSON·history는 보존합니다. 다시 0.2.0으로 올리면 같은 ID와 보고 상태를 사용합니다. 저장소를 구버전 데이터로 변환하거나 삭제하지 않습니다. 0.3.0은 같은 registry schema 1에 선택 필드 modelChoices version 1을 추가합니다. 0.2.0의 실제 registry 변경이 이 필드를 보존하는 합성 롤백을 검사합니다. 이전 코드는 Y/N을 강제하지 않으므로 새 선택 흐름은 재업그레이드 후 재개합니다. 이후 스키마가 다르면 명시적인 호환성 검토 없이 롤백하지 않습니다.

기존 전역 상태 hook이 있다면 중복 지침이 생길 수 있습니다. 플러그인이 기존 설정을 바꾸지는 않으므로 `/hooks`에서 사용할 쪽을 선택하세요. Herdr에서 실행된 **Codex 채팅 제목**에도 같은 규칙을 사용할 수 있으나 Herdr 패널·Hermes·다른 에이전트의 이름은 변경하지 않습니다.

## 검증과 한계

```text
node --test plugins/session-status/tests/*.test.mjs
```

합성 제목·모의 Codex API·실제 stdio MCP의 초기화와 tool 호출을 검사합니다. 테스트는 실제 사용자 세션을 읽거나 바꾸지 않습니다. 제목 대조는 낡은 요청을 거부하지만 별도 클라이언트가 쓰기 직전에 동시에 변경하는 경쟁을 원자적으로 막지는 못합니다. 완료 라벨은 작업 성공의 인증서가 아닙니다. 자동 skill 선택과 UI 반영은 Codex 버전·권한·hook 신뢰 상태에 영향을 받습니다.

설치 방식은 [공식 플러그인 문서](https://developers.openai.com/plugins/build/plugins), hook 검토는 [공식 hook 문서](https://learn.chatgpt.com/docs/hooks)를 참고하세요. GitHub 커뮤니티 배포이며 OpenAI 공식 Directory 등록을 뜻하지 않습니다.

English: A local-only skill, eleven MCP tools and two lifecycle context hooks for evidence-based chat status prefixes. Hooks remind the agent; the agent selects the label and performs a verified title update. No task completion is inferred from a stopped turn.
