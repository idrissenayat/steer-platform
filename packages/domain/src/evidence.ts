import type { WorkItemChain } from "./types";

export interface EvidenceLine {
  id: string;
  label: string;
  state: "pass" | "fail" | "stale";
  detail: string;
}

export interface AssembledEvidence {
  revision?: string;
  current: boolean;
  gateThreeReady: boolean;
  cases: EvidenceLine[];
  findings: EvidenceLine[];
  plan: EvidenceLine;
}

export function assembleEvidence(item: WorkItemChain): AssembledEvidence {
  const diff = item.artifacts.find((artifact) => artifact.kind === "diff");
  const evidence = item.evidence;
  const current = Boolean(diff && evidence && evidence.revision === diff.revision);
  const state = (passed: boolean, revision?: string): EvidenceLine["state"] => {
    if (!current || revision !== diff?.revision) return "stale";
    return passed ? "pass" : "fail";
  };

  const cases = (evidence?.examCases ?? []).map((result) => ({
    id: result.id,
    label: result.name,
    state: state(result.passed, result.revision),
    detail: result.passed ? "Passed" : "Failed",
  }));
  const findings = (evidence?.findings ?? []).map((finding) => ({
    id: finding.id,
    label: finding.summary,
    state: state(finding.rank !== "blocker" && finding.rank !== "major", finding.revision),
    detail: finding.rank,
  }));
  const plan = {
    id: "plan-conformance",
    label: "Plan conformance",
    state: state(Boolean(evidence?.planConformant), evidence?.planRevision ?? evidence?.revision),
    detail: evidence?.planConformant ? "Conformant" : "Not conformant",
  } satisfies EvidenceLine;

  const all = [...cases, ...findings, plan];
  return {
    ...(diff?.revision ? { revision: diff.revision } : {}),
    current,
    gateThreeReady:
      current &&
      Boolean(evidence?.examPassed && evidence.planConformant) &&
      all.every((line) => line.state === "pass"),
    cases,
    findings,
    plan,
  };
}
