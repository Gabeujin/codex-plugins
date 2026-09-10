# First use / 첫 사용

Run these script examples from a separate repository checkout, not by editing an installed plugin cache. Replace angle-bracket output placeholders with a new folder path and quote paths containing spaces. See [installation and updates](INSTALL-AND-UPDATE.md).

These are small, local starting tasks. They do not establish publication, production, or browser-proof claims.

| Plugin | English first task | 한국어 첫 작업 | Expected result / 예상 결과 | Failure next action / 실패 시 다음 행동 |
| --- | --- | --- | --- | --- |
| K-Tech Radar | Run `node plugins/k-tech-radar/scripts/offline-demo.mjs`. | `node plugins/k-tech-radar/scripts/offline-demo.mjs`를 실행합니다. | Output says `SYNTHETIC — NOT FOR RESEARCH`, `networkUsed: false`, and `userDataWritten: false`. / 가상 데이터, 네트워크·사용자 데이터 미사용이 표시됩니다. | Check Node is available, then run from the repository root. Do not treat fixture output as a citation. / Node 설치와 저장소 루트를 확인하고, 결과를 실제 근거로 쓰지 않습니다. |
| KGJ Design | Compare examples without changing either input: `python -X utf8 -B plugins/kgj-design/scripts/kgj_design.py preview-dna plugins/kgj-design/examples/dna/operations-console.json plugins/kgj-design/examples/dna/research-report.json --output <new-folder-outside-repo>`. | 입력을 바꾸지 않고 위 명령으로 DNA 미리보기를 만듭니다. | A new folder contains `index.html`, both CSS files, and `preview.json` with source hashes. / 새 폴더에 HTML, 두 CSS, 해시가 있는 JSON이 생깁니다. | Choose a new output folder; existing folders and stale expected hashes are rejected. / 새 출력 폴더를 쓰고, 기존 폴더·오래된 해시는 거부됩니다. |
| Canvas Web Experiences | Create a small starter: `python -X utf8 -B plugins/canvas-web-experiences/scripts/create_canvas_starter.py --kind 2d --output <new-folder>`. | 작은 스타터를 만듭니다: 위 명령을 실행합니다. | A dependency-free starter with keyboard controls and semantic fallback is created. / 키보드 조작과 의미적 대체 경로가 있는 의존성 없는 스타터가 생성됩니다. | Use a non-existing output path whose parent exists; then run `node --check app.js` in the starter. / 부모 폴더가 있는 새 경로를 지정하고 생성 후 `node --check app.js`를 실행합니다. |

## Evaluation kit / 평가 키트

`docs/evaluations/scenarios.json` defines 24 routed fixtures: five positive and three negative cases for each plugin, plus cross-plugin overlap prompts. They are expected-behavior definitions, not a claim that a model was evaluated.

After collecting real transcripts, run:

```text
node docs/evaluations/run-transcript-evaluation.mjs --transcripts transcripts.json --settings settings.json --model <name> --version <version> --manual-verdict manual.json --output evaluation-result.json
```

The runner records hashes of actual transcripts, model/version/settings, and a supplied human verdict. Without `--manual-verdict` its status remains `pending-manual-verdict`; it intentionally does not award a pass from string matching.

## Human tester target / 사람 대상 테스트 목표

Recruit five voluntary testers for each plugin. The target is four of five people completing the small first task without extra explanation. This is pending, not a measured result. Record consent, environment, task completion, time, failure reason, and a human observation; do not add automatic telemetry.
