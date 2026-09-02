export const intentInterviewQuestions = [
  { key: "title", prompt: "What short working title should we use?", help: "A label only; it can change later." },
  { key: "problem", prompt: "What is happening now?", help: "Describe the observed problem without prescribing a solution." },
  { key: "users", prompt: "Who exactly is affected?", help: "Name the people or groups, separated with commas." },
  { key: "outcome", prompt: "What should become true?", help: "Describe one measurable change in their reality." },
  { key: "successMeasure", prompt: "How would we know it worked?", help: "Name the signal, metric, or observable evidence." },
  { key: "systems", prompt: "Which real systems does this touch?", help: "Use the names your organization already uses." },
  { key: "constraints", prompt: "Which constraints or deadlines are real?", help: "Separate contractual facts from preferences." },
  { key: "openQuestions", prompt: "What remains uncertain?", help: "Say “none yet” if no question has surfaced." },
] as const;

export type IntentAnswerKey = (typeof intentInterviewQuestions)[number]["key"];
export type IntentAnswers = Record<IntentAnswerKey, string>;

export const blankIntentAnswers: IntentAnswers = {
  title: "",
  problem: "",
  users: "",
  outcome: "",
  successMeasure: "",
  systems: "",
  constraints: "",
  openQuestions: "",
};

export const pilotSystemContext = [
  "STEER platform",
  "Pilot repository",
  "GitHub",
  "CI",
  "Metrics",
  "Notifications",
] as const;

const split = (value: string) => value.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean);

export interface InterviewDraft {
  constraints: string[];
  openQuestions: string[];
  outcome: string;
  problem: string;
  resolvedSystems: string[];
  successMeasure: string;
  title: string;
  unresolvedSystems: string[];
  users: string[];
}

export function buildInterviewDraft(answers: IntentAnswers, knownSystems: readonly string[]): InterviewDraft {
  const byLowerName = new Map(knownSystems.map((system) => [system.toLowerCase(), system]));
  const requestedSystems = split(answers.systems);
  const resolvedSystems = requestedSystems.flatMap((system) => {
    const resolved = byLowerName.get(system.toLowerCase());
    return resolved ? [resolved] : [];
  });
  const unresolvedSystems = requestedSystems.filter((system) => !byLowerName.has(system.toLowerCase()));
  const statedQuestions = split(answers.openQuestions).filter((question) => !/^none( yet)?[.!]?$/i.test(question));
  const openQuestions = [
    ...statedQuestions,
    ...(!answers.successMeasure.trim() ? ["How will success be measured?"] : []),
    ...unresolvedSystems.map((system) => `Confirm the real system name for “${system}”.`),
  ];

  return {
    title: answers.title.trim(),
    problem: answers.problem.trim(),
    users: split(answers.users),
    outcome: answers.outcome.trim(),
    successMeasure: answers.successMeasure.trim(),
    resolvedSystems,
    unresolvedSystems,
    constraints: split(answers.constraints).filter((constraint) => !/^none[.!]?$/i.test(constraint)),
    openQuestions,
  };
}

export function correctionDisposition(corrections: string[], pattern: string): "keep-in-session" | "promote-to-versioned-context" {
  const repeats = corrections.filter((correction) => correction === pattern).length;
  return repeats >= 2 ? "promote-to-versioned-context" : "keep-in-session";
}
