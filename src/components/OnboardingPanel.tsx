import { useEffect, useMemo, useRef, useState } from "react";
import { proposeOrganizationSetup, type OperatingProfile, type OrganizationProposal, type RepositoryMode, type TeamMode } from "../domain/organization";
import { CloseIcon } from "./Icons";

export function OnboardingPanel({ humanName, onClose, onComplete }: { humanName: string; onClose: () => void; onComplete: (proposal: OrganizationProposal) => void }) {
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<"intent" | "questions" | "review">("intent");
  const [profile, setProfile] = useState<OperatingProfile>("commercial");
  const [repositoryMode, setRepositoryMode] = useState<RepositoryMode>("existing");
  const [teamMode, setTeamMode] = useState<TeamMode>("solo");
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const proposal = useMemo(() => phase === "review" ? proposeOrganizationSetup({ description, humanName, profile, repositoryMode, teamMode }) : null, [description, humanName, phase, profile, repositoryMode, teamMode]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), textarea"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function continueFromIntent() {
    if (!description.trim()) { setError("Tell the platform agent what you are building first."); return; }
    setError(null);
    setPhase("questions");
  }

  return <div aria-label="Agent-first organization onboarding" aria-modal="true" className="review-backdrop" onKeyDown={handleKeyDown} role="dialog">
    <section className="review-panel review-panel--wide onboarding-panel" ref={panelRef}>
      <button aria-label="Close onboarding" className="drawer-close icon-button" onClick={onClose} ref={closeRef} type="button"><CloseIcon /></button>
      <header className="review-panel__header"><div><p className="eyebrow">Operating Model v3.1 · talk, correct, sign</p><h2>Set up STEER with the platform agent</h2><p>The agent does the administration. You provide truth and make the final commitment.</p></div></header>

      {phase === "intent" ? <div className="onboarding-conversation">
        <div className="agent-message"><span>Platform agent</span><p>What are you building? One plain-language description is enough to start.</p></div>
        <label className="onboarding-reply"><span>Your reply</span><textarea aria-describedby={error ? "onboarding-error" : undefined} onChange={(event) => setDescription(event.target.value)} placeholder="I’m building…" rows={5} value={description} /></label>
        {error ? <p id="onboarding-error" role="alert">{error}</p> : null}
        <button className="primary-action" onClick={continueFromIntent} type="button">Ask the setup questions</button>
      </div> : null}

      {phase === "questions" ? <div className="onboarding-conversation">
        <div className="human-message"><span>You</span><p>{description}</p></div>
        <div className="agent-message"><span>Platform agent</span><p>Three decisions shape the operating setup. Choose the answer that fits now; each remains versioned and changeable later.</p></div>
        <fieldset><legend>Are you operating solo or with a team?</legend><div className="choice-row"><button aria-pressed={teamMode === "solo"} onClick={() => setTeamMode("solo")} type="button">Solo · I hold every hat</button><button aria-pressed={teamMode === "team"} onClick={() => setTeamMode("team")} type="button">Team · propose assignments</button></div></fieldset>
        <fieldset><legend>Is there an existing code repository?</legend><div className="choice-row"><button aria-pressed={repositoryMode === "existing"} onClick={() => setRepositoryMode("existing")} type="button">Existing · run readiness scan</button><button aria-pressed={repositoryMode === "greenfield"} onClick={() => setRepositoryMode("greenfield")} type="button">New · scaffold it</button></div></fieldset>
        <fieldset><legend>Which operating profile applies?</legend><div className="choice-row"><button aria-pressed={profile === "commercial"} onClick={() => setProfile("commercial")} type="button">Commercial</button><button aria-pressed={profile === "regulated"} onClick={() => setProfile("regulated")} type="button">Regulated</button></div></fieldset>
        <div className="onboarding-actions"><button className="secondary-action" onClick={() => setPhase("intent")} type="button">Back</button><button className="primary-action" onClick={() => setPhase("review")} type="button">Build the operating summary</button></div>
      </div> : null}

      {phase === "review" && proposal ? <div className="onboarding-summary">
        <div className="agent-message"><span>Platform agent</span><p>{proposal.summary}</p></div>
        <div className="onboarding-summary-grid">
          <section><span>Organization topology</span><strong>Organization → Portfolio → Product → Pod</strong><small>{proposal.artifactPaths.join(" · ")}</small></section>
          <section><span>Your hats</span><strong>{proposal.assignments.length} explicit accountabilities</strong><small>{proposal.assignments.map((assignment) => assignment.hat.replaceAll("-", " ")).join(" · ")}</small></section>
          <section><span>Stack Pack</span><strong>{proposal.stackPack}</strong><small>Builder binding, guardrails, exam templates, release rails, and starter context</small></section>
          <section><span>Readiness</span><strong>{proposal.readiness.filter((finding) => finding.onRampBrief).length} on-ramp briefs drafted</strong><small>{proposal.readiness.map((finding) => `${finding.check}: ${finding.state}`).join(" · ")}</small></section>
        </div>
        <div className="signer-constraint"><span>Signer policy stated before the first gate</span><p>{proposal.signerConstraint}</p></div>
        <div className="onboarding-actions"><button className="secondary-action" onClick={() => setPhase("questions")} type="button">Correct the setup</button><button className="primary-action" onClick={() => onComplete(proposal)} type="button">Sign once and start the loop</button></div>
      </div> : null}
    </section>
  </div>;
}
