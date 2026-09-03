# Proposed accessibility checkpoint model v1

Status: **unsigned remediation support; not release evidence**

This fixed model is the manual complement to automated WCAG 2.1 AA and
Section 508 evaluation. Each checkpoint is recorded independently as `pass`,
`fail`, or `not-applicable` with a rationale; omission is failure. Any `fail`
blocks the user-facing technical-release verdict regardless of severity.

## Keyboard and focus (A01-A18)

1. `A01` Every operable element is reachable in semantic order.
2. `A02` Every operable element works without pointer input.
3. `A03` No keyboard trap exists, including inside dialogs and menus.
4. `A04` Focus is always visibly distinguishable.
5. `A05` Focus order matches reading and task order.
6. `A06` Route changes place focus at the new view heading.
7. `A07` Dialog open moves focus to its heading or first field.
8. `A08` Dialog close restores focus to the invoker.
9. `A09` Validation failure moves focus to the error summary.
10. `A10` Async refresh does not steal focus.
11. `A11` Loading completion preserves or predictably moves focus.
12. `A12` Stale-card replacement preserves a usable focus target.
13. `A13` Send-back and correction flows have deterministic focus order.
14. `A14` Signature confirmation requires an explicit focused action.
15. `A15` Escape closes only the top dismissible layer.
16. `A16` Skip navigation reaches primary content.
17. `A17` Roving-tabindex components expose one active tab stop.
18. `A18` Mobile-width keyboard operation retains every desktop action.

## Name, role, value, and structure (A19-A36)

19. `A19` Every control has an accessible name matching visible meaning.
20. `A20` Roles are native or correctly implemented with ARIA.
21. `A21` State and value changes are programmatically exposed.
22. `A22` Heading levels describe the page hierarchy without skips.
23. `A23` Landmarks are unique or distinctly labelled.
24. `A24` Lists, tables, and definition relationships are semantic.
25. `A25` Decision-card status is not conveyed by color alone.
26. `A26` Specialist-card status is not conveyed by color alone.
27. `A27` Signed and unsigned states have explicit text alternatives.
28. `A28` Stale and breached states have explicit text alternatives.
29. `A29` Buttons and links expose purpose in context.
30. `A30` Disabled actions expose both state and reason.
31. `A31` Form labels remain associated after validation.
32. `A32` Required fields and constraints are programmatically identified.
33. `A33` Error messages identify the field and corrective action.
34. `A34` Tables expose row and column headers.
35. `A35` Custom widgets match their documented keyboard pattern.
36. `A36` Decorative graphics are hidden from assistive technology.

## Announcements, streaming, and dynamic state (A37-A50)

37. `A37` Route title and primary heading are announced.
38. `A38` Loading state is announced once without repeated noise.
39. `A39` Empty state and its recovery action are announced.
40. `A40` Permission denial is announced with no protected detail.
41. `A41` Stale revision rejection and refresh are announced.
42. `A42` Band breach and urgency changes are announced.
43. `A43` Validation summaries use an appropriate live region.
44. `A44` Save success is announced only after authoritative success.
45. `A45` Save failure is announced with retry safety.
46. `A46` Streamed assistant content is readable without token-level chatter.
47. `A47` Stream completion is announced once.
48. `A48` Stream interruption exposes retry or recovery.
49. `A49` Background projection refresh announces meaningful changes only.
50. `A50` Signature success names the gate, decision, and bound revision.

## Visual, responsive, and sensory access (A51-A63)

51. `A51` Text and essential graphics meet applicable contrast ratios.
52. `A52` Focus indicators meet contrast and area requirements.
53. `A53` Content reflows at 320 CSS px without two-dimensional scrolling.
54. `A54` Text at 200 percent remains complete and operable.
55. `A55` Text spacing overrides do not clip or overlap content.
56. `A56` Orientation is not restricted without essential reason.
57. `A57` Target size and spacing support accurate activation.
58. `A58` Hover or focus content is dismissible, hoverable, and persistent.
59. `A59` Motion respects reduced-motion preference.
60. `A60` No flashing content exceeds applicable thresholds.
61. `A61` Meaning does not depend only on shape, position, or sound.
62. `A62` Zoomed dialogs keep title, content, and actions reachable.
63. `A63` High-contrast or forced-color mode preserves state distinctions.

## Errors, recovery, and consequential actions (A64-A74)

64. `A64` Errors are identified in text and tied to their source.
65. `A65` Correction suggestions are provided when known.
66. `A66` Previously valid input survives a recoverable failure.
67. `A67` Timeout warning permits extension when policy allows.
68. `A68` Expired sessions return to a safe reauthentication path.
69. `A69` Concurrent conflict explains that no decision was recorded.
70. `A70` Unknown provider outcome prevents duplicate submission.
71. `A71` Send-back shows the exact target and retains the note on failure.
72. `A72` Decline and merge provide review before irreversible submission.
73. `A73` Gate signatures provide review, confirmation, and cancellation.
74. `A74` Confirmation never implies release, production, or spending authority.

## Content, language, and compatibility (A75-A81)

75. `A75` Page and changed-content language are programmatically identified.
76. `A76` Instructions do not rely solely on sensory characteristics.
77. `A77` Link and control labels remain consistent across routes.
78. `A78` Help and contact mechanisms remain consistently located.
79. `A79` Status, error, and confirmation content survives refresh/reconnect.
80. `A80` Markup and accessibility APIs expose unique, valid relationships.
81. `A81` The tested browser/OS/assistive-technology combination completes the
    end-to-end decision, escalation, correction, and signature scenarios.

## Required raw record

For every checkpoint and scenario, retain checkpoint ID, route/state ID,
viewport, browser version, OS version, assistive-technology version, operator
identity, start/end timestamps, outcome, notes, evidence references, Exam
revision, and implementation revision. The signed summary is supplemental; it
cannot replace the 81 raw results for each required scenario/environment pair.
