# Demo modernization checklist

Use this checklist when adapting the bundled demo. It is a planning aid, not a record of a completed test run.

| Area | Review question | Required outcome before release |
| --- | --- | --- |
| Primary task | Is the task and next action clearer than diagnostics? | The task can be completed with pointer, keyboard, and touch alternatives. |
| Scene composition | Does each domain use a distinct visual grammar without obscuring controls? | The selected concept maps to implemented components and responsive states. |
| Semantic projection | Does durable scene state remain available in DOM text, forms, or tables? | A non-canvas user can understand and operate the primary workflow. |
| Experimental lanes | Is every experimental API feature-detected and isolated? | A DOM or conventional-texture fallback preserves the task. |
| Responsive layout | Do narrow viewports preserve controls and readable state? | Verify the actual target viewport after each material change. |
| Assets | Are bundled images licensed, local, and referenced by stable paths? | Keep only public assets required by the source tree. |

Record fresh evidence outside the plugin source for the exact revision under review. Do not transfer a prior browser result to a changed source.
