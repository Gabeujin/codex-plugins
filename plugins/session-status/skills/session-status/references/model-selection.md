# 작업별 모델과 추론 수준

공식 본문 확인일: 2026-11-17. [작업별 모델 선택](https://developers.openai.com/api/docs/guides/model-selection), [Codex 모델 안내](https://developers.openai.com/codex/models)를 세션 생성 시 다시 확인한다. 아래 표는 추천 출발점이며 고정된 성능·요금·사용량 보장이 아니다. API ID와 Codex host slug는 서로 대신 쓰지 않는다.

| 작업 | 기본 후보 | 추론 출발점 | 판단 근거 |
| --- | --- | --- | --- |
| 단순 추출·기계적 수정 | 현재 제공되는 Luna | low | 공식 작업별 예시. 일반 Codex Luna 기본 권고인 High와 맥락이 다름 |
| 범위가 명확한 코드 수정·제공 자료 정리 | 현재 제공되는 Terra | medium | Terra 용도는 공식 안내, medium은 이 플러그인의 비교 출발점 |
| 여러 파일의 기술 작업·분석·일반 DB 검토 | 현재 제공되는 Sol | medium | 공식 복잡한 기술 작업 예시 |
| 상충하는 근거·공통 계약·엄격한 검증 | 현재 제공되는 Sol | high 또는 xhigh | high는 비용을 고려한 출발점, xhigh는 공식 상충 근거 예시 |
| Sol 검토 후에도 남은 매우 어려운 문제 | Astra, 필요성 기록 필수 | low만 | Astra는 예외. 높은 추론 수준의 토큰·사용한도 소모에 주의 |

DB라는 이름만으로 높은 모델을 고르지 않는다. 단일 조회 분석과 실제 스키마·권한 변경은 위험이 다르다. 모델을 높여도 DB 접근 권한이나 독립 검토·실행 검증을 대신할 수 없다. 문맥이 크면 먼저 필요한 소스와 확인 조건을 좁힌다.

`recommend_session_model`에는 실행 도구가 현재 제공하는 `{model, efforts}` 목록을 `live_catalog` JSON 문자열로 전달한다. 지원하지 않는 조합이면 기본값을 유지하고 공식 문서와 실제 제공 목록을 다시 확인한다. 명시한 사용자 모델은 보존한다. Astra에는 `astra_necessity`로 구체적인 필요성을 반드시 기록하며, 이를 생략하면 추천을 거부한다. Sol의 추론 수준 상향은 남은 문제와 예상 비용을 고려해 결정한다. Astra는 low만 허용하며 high·xhigh·max·ultra 등으로 자동 상향하지 않는다. Max/Ultra는 자동 추천하지 않는다.

조건별 모델 정책은 후보를 정하는 기준이다. 모델을 제안하면 prepare_model_choice의 정확한 모델·추론·목적지·기본값 질문으로 인간의 Y/N을 받는다. Y는 그 이름이 명시된 추천을 적용하고 N은 model·thinking을 모두 생략한다. 미응답은 pending이다. create_thread의 특정 모델 명시 요구 등 host 규칙은 그대로 적용하며 일반적인 자동 선택 허가나 에이전트의 답변으로 인간의 Y를 대신하지 않는다. 실행 중인 root·부모의 모델은 바꾸지 않는다.
