export interface BriefDraftInput {
  author?: string;
  title: string;
  problem: string;
  outcome: string;
  users: string[];
  systems: string[];
  constraints: string[];
  openQuestions: string[];
  successMeasure?: string;
  sizing?: {
    coherentShape: boolean;
    examWritable: boolean;
    plannedFiles?: number;
  };
}

export interface BriefDraft {
  markdown: string;
  templateVersion: "steer-brief/v1";
  validation: { valid: boolean; missing: string[] };
}

const requiredSections = [
  "## Problem",
  "## Proposed outcome",
  "## Affected users and systems",
  "## Constraints",
  "## Open questions",
];

const list = (values: string[], fallback: string) =>
  (values.length ? values : [fallback]).map((value) => `- ${value}`).join("\n");

export function draftBrief(input: BriefDraftInput): BriefDraft {
  const markdown = `# Brief: ${input.title.trim() || "Untitled intent"}

Status: draft, originator review required.
Originator: ${input.author?.trim() || "To be bound by the configured connector"}

## Problem

${input.problem.trim()}

## Proposed outcome

${input.outcome.trim()}

## Outcome contract

- Success signal: ${input.successMeasure?.trim() || "To be confirmed in Open Questions."}
- Baseline: to be captured before Gate 1.
- Target: originator and Product Lead to define.
- Observation window: to be defined.
- Guardrail: human hours per shipped item must not rise.

## Affected users and systems

### Users
${list(input.users, "No user group supplied")}

### Systems
${list(input.systems, "No system supplied")}

## Constraints

${list(input.constraints, "No additional constraint supplied")}

## Sizing and scoping

- One outcome: ${input.outcome.trim() ? "yes" : "not yet"}
- One crisp exam can be written: ${input.sizing?.examWritable ? "yes" : "not yet confirmed"}
- One coherent shape: ${input.sizing?.coherentShape ? "yes" : "not yet confirmed"}
- Expected systems touched: ${input.systems.length || "not yet known"}
- Expected files touched: ${input.sizing?.plannedFiles || "not yet known"}
- Scope freezes at Gate 1; new wants return as a revision or a new brief.

## Domain tags

- To be classified before Gate 1.

## Open questions

${list(input.openQuestions, "No open question supplied")}
`;
  const missing = [
    !input.problem.trim() ? "problem" : "",
    !input.outcome.trim() ? "proposed outcome" : "",
    !input.users.some((value) => value.trim()) ? "affected users" : "",
    !input.systems.some((value) => value.trim()) ? "affected systems" : "",
    ...requiredSections.filter((section) => !markdown.includes(section)),
  ].filter(Boolean);

  return { markdown, templateVersion: "steer-brief/v1", validation: { valid: missing.length === 0, missing } };
}

export function draftRevision(markdown: string): string {
  let hash = 0x811c9dc5;
  for (const character of markdown) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
