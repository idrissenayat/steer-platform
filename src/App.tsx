import { useEffect, useMemo, useRef, useState } from "react";
import { BoardIcon, ChainIcon, CloseIcon, InboxIcon, ShieldIcon } from "./components/Icons";
import { GlossaryPeek, LearnHub } from "./components/LearnHub";
import { demoAsOf, demoChain } from "./data/demo-chain";
import { demoIntents, pilotMetrics, pilotWipLimit } from "./data/demo-intents";
import { applyGateAction } from "./domain/actions";
import { draftBrief, draftRevision } from "./domain/brief-author";
import { assembleEvidence } from "./domain/evidence";
import { performDetailAction, previewMergedIntent, recordExternalExit, type DetailAction, type DetailActionEvent, type DetailActionResult } from "./domain/intent-detail";
import type { HubEvent, LearnPage } from "./domain/learn";
import { blankIntentAnswers, buildInterviewDraft, intentInterviewQuestions, pilotSystemContext, type IntentAnswers } from "./domain/intent-interview";
import { declineIntent, projectIntentBacklog, pullDisposition, type IntentCandidate, type ProjectedIntent } from "./domain/intent-backlog";
import { buildReadModel, decisionsForRole } from "./domain/read-model";
import { assessScope } from "./domain/sizing";
import type {
  DecisionCard,
  FlightStage,
  Gate,
  IdentityContext,
  ProjectedWorkItem,
  Role,
  WorkItemChain,
} from "./domain/types";

const roleLabels: Record<Role, string> = {
  "product-lead": "Product Lead",
  "product-designer": "Product Designer",
  "tech-lead": "Tech Lead",
  "platform-engineer": "Platform Engineer",
  specialist: "Domain Specialist",
};

const stageLabels: Record<FlightStage, string> = {
  sense: "Sense",
  "frame-intent": "Frame · Intent",
  "frame-exam": "Frame · Exam",
  engineer: "Engineer",
  evaluate: "Evaluate",
  release: "Release",
  observe: "Observe",
  learn: "Learn",
};

const gateDescriptions: Record<Gate, string> = {
  1: "Intent and outcome",
  2: "Provably done",
  3: "Evidence supports release",
};

const actorNames: Record<Role, string> = {
  "product-lead": "Idriss Enayat",
  "product-designer": "Avery Chen",
  "tech-lead": "Morgan Lee",
  "platform-engineer": "Riley Brooks",
  specialist: "Jordan Patel",
};

function formatWait(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
}

function formatDue(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function MetricCard({ icon, label, note, tone, value }: {
  icon: string;
  label: string;
  note: string;
  tone: "aqua" | "amber" | "blue" | "coral";
  value: string;
}) {
  return (
    <article className="metric-card">
      <span aria-hidden="true" className={`metric-card__icon metric-card__icon--${tone}`}>{icon}</span>
      <div><p>{label}</p><strong>{value}</strong><span>{note}</span></div>
    </article>
  );
}

function DecisionItem({ decision, onOpen }: { decision: DecisionCard; onOpen: (decision: DecisionCard) => void }) {
  return (
    <article className="decision-card">
      <div className="decision-card__rail" data-urgency={decision.urgency} />
      <div className="decision-card__body">
        <div className="decision-card__meta">
          <span className={`urgency urgency--${decision.urgency}`}>
            {decision.slaBreached ? "SLA breached" : decision.urgency === "due-soon" ? "Due soon" : "On track"}
          </span>
          <span>Gate {decision.gate}</span><span>{decision.itemId}</span>
        </div>
        <div className="decision-card__content">
          <div><h3>{decision.title}</h3><p>{decision.summary}</p></div>
          <div className="decision-card__facts">
            <span><small>Decision</small>{gateDescriptions[decision.gate]}</span>
            <span><small>Due</small>{formatDue(decision.dueAt)}</span>
            <span><small>Revision</small><code>{decision.revision}</code></span>
          </div>
        </div>
      </div>
      <button className="review-button" onClick={() => onOpen(decision)} type="button">
        Review decision <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function DrawerFrame({ children, label, onClose, wide = false }: {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => previous?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, textarea, select, a[href]"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div aria-label={label} aria-modal="true" className="review-backdrop" onKeyDown={handleKeyDown} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} role="dialog">
      <section className={wide ? "review-panel review-panel--wide" : "review-panel"} ref={panelRef}>
        <button aria-label="Close review" className="drawer-close icon-button" onClick={onClose} ref={closeButtonRef} type="button"><CloseIcon /></button>
        {children}
      </section>
    </div>
  );
}

function ReviewPanel({ decision, item, onAction, onClose }: {
  decision: DecisionCard;
  item: ProjectedWorkItem;
  onAction: (kind: "sign" | "send-back", note?: string) => void;
  onClose: () => void;
}) {
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState("");
  const evidence = assembleEvidence(item);
  const brief = item.artifacts.find((artifact) => artifact.kind === "brief");
  const spec = item.artifacts.find((artifact) => artifact.kind === "spec");
  const exam = item.artifacts.find((artifact) => artifact.kind === "exam");

  return (
    <DrawerFrame label={`${decision.title} Gate ${decision.gate} review`} onClose={onClose}>
      <header className="review-panel__header">
        <div><p className="eyebrow">{decision.itemId} · Gate {decision.gate}</p><h2>{decision.title}</h2></div>
      </header>
      <div className="review-panel__section review-panel__lead">
        <span className="status-dot" />
        <div><strong>Ready for {roleLabels[decision.role]}</strong><p>{gateDescriptions[decision.gate]} · revision {decision.revision}</p></div>
      </div>
      <div className="review-panel__section">
        <p className="section-label">Outcome contract</p><p className="outcome-copy">{decision.outcome}</p>
      </div>

      {decision.gate === 1 ? (
        <div className="review-panel__section">
          <p className="section-label">Intent and design, side by side</p>
          <div className="artifact-compare">
            <article><span>BRIEF · {brief?.revision}</span><p>{brief?.content ?? "Brief content is available in the artifact chain."}</p></article>
            <article><span>SPEC · {spec?.revision}</span><p>{spec?.content ?? "Spec content is available in the artifact chain."}</p></article>
          </div>
        </div>
      ) : null}

      {decision.gate === 2 ? (
        <div className="review-panel__section">
          <p className="section-label">Independent exam</p>
          <p className="outcome-copy">{exam?.content ?? "Review the independently authored exam and activated guardrails."}</p>
        </div>
      ) : null}

      {decision.gate === 3 ? (
        <div className="review-panel__section">
          <div className="evidence-heading"><p className="section-label">Evidence at {evidence.revision}</p><span className="evidence-badge"><ShieldIcon />{evidence.current ? "Revision current" : "Stale"}</span></div>
          <div className="evidence-grid">
            {[...evidence.cases, ...evidence.findings, evidence.plan].map((line) => (
              <div className={`evidence-line evidence-line--${line.state}`} key={line.id}><b>{line.state === "pass" ? "✓" : line.state === "stale" ? "◷" : "!"}</b><span><strong>{line.label}</strong><small>{line.detail}</small></span></div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="review-panel__section">
        <p className="section-label">Risk domains and conditional seats</p>
        <div className="tag-row">{decision.riskDomains.map((domain) => <span className="domain-tag" key={domain}>{domain}</span>)}</div>
      </div>

      <footer className="review-panel__footer">
        <p>The connector will bind your identity, sequence position {decision.sequencePosition}, and revision {decision.revision}.</p>
        {sendingBack ? (
          <label className="send-back-field"><span>What must change?</span><textarea autoFocus onChange={(event) => setNote(event.target.value)} rows={3} value={note} /></label>
        ) : null}
        <div className="drawer-actions">
          <button className="secondary-button" onClick={() => sendingBack ? onAction("send-back", note) : setSendingBack(true)} type="button">{sendingBack ? "Send back with note" : "Send back"}</button>
          <button className="primary-button" onClick={() => onAction("sign")} type="button">Sign this revision</button>
        </div>
      </footer>
    </DrawerFrame>
  );
}

function WorkItemPanel({ item, onClose }: { item: ProjectedWorkItem; onClose: () => void }) {
  return (
    <DrawerFrame label={`${item.title} work item thread`} onClose={onClose}>
      <header className="review-panel__header"><div><p className="eyebrow">{item.id} · {stageLabels[item.stage]}</p><h2>{item.title}</h2><p>{item.summary}</p></div></header>
      <div className="review-panel__section"><p className="section-label">Outcome contract</p><p className="outcome-copy">{item.outcome}</p></div>
      <div className="review-panel__section"><p className="section-label">State aging</p><p className="outcome-copy">{formatWait(item.aging.ageHours)} in {stageLabels[item.stage]} · expected band {formatWait(item.aging.expectedMaxHours)} · {item.aging.state === "huddle" ? "huddle required" : "within band"}</p></div>
      <div className="review-panel__section">
        <p className="section-label">Continuous artifact thread</p>
        <ol className="artifact-thread">
          {item.artifacts.map((artifact) => (
            <li key={`${artifact.kind}-${artifact.revision}`}><span>{artifact.kind.toUpperCase()}</span><div><strong>{artifact.path ?? "Artifact chain"}</strong><code>{artifact.revision}</code><small>{formatDue(artifact.updatedAt)}</small></div></li>
          ))}
        </ol>
      </div>
      <div className="review-panel__section">
        <p className="section-label">Authenticated signatures</p>
        {item.signatures.length ? <ul className="signature-list">{item.signatures.map((signature, index) => <li key={`${signature.gate}-${signature.role}-${index}`}><b>Gate {signature.gate}</b><span>{signature.signer} · {roleLabels[signature.role]}</span><code>{signature.revision}</code></li>)}</ul> : <p className="muted-copy">No signatures recorded yet.</p>}
      </div>
      <footer className="review-panel__footer"><p>This view is assembled from the chain; no status field is stored.</p><button className="secondary-button" onClick={onClose} type="button">Return to workspace</button></footer>
    </DrawerFrame>
  );
}

function BriefComposer({ onClose, onSave, originator }: { onClose: () => void; onSave: (intent: IntentCandidate) => void; originator: IdentityContext }) {
  const [answers, setAnswers] = useState<IntentAnswers>(blankIntentAnswers);
  const [step, setStep] = useState(0);
  const [response, setResponse] = useState("");
  const [editing, setEditing] = useState(false);
  const [examWritable, setExamWritable] = useState(false);
  const [coherentShape, setCoherentShape] = useState(false);
  const interviewComplete = step >= intentInterviewQuestions.length;
  const currentQuestion = interviewComplete ? undefined : intentInterviewQuestions[step];
  const interview = buildInterviewDraft(answers, pilotSystemContext);
  const scope = assessScope({
    outcomeCount: interview.outcome ? 1 : 0,
    examCount: examWritable ? 1 : 0,
    examWritable,
    coherentShape,
    touchedSystems: interview.resolvedSystems.length,
  });
  const draft = draftBrief({
    author: `${originator.displayName} (${originator.subject})`,
    title: interview.title,
    problem: interview.problem,
    outcome: interview.outcome,
    successMeasure: interview.successMeasure,
    users: interview.users,
    systems: interview.resolvedSystems,
    constraints: interview.constraints,
    openQuestions: interview.openQuestions,
    sizing: { examWritable, coherentShape },
  });

  function submitAnswer() {
    if (!currentQuestion || !response.trim()) return;
    setAnswers((current) => ({ ...current, [currentQuestion.key]: response.trim() }));
    setResponse("");
    setStep(editing ? intentInterviewQuestions.length : step + 1);
    setEditing(false);
  }

  function editAnswer(index: number) {
    const question = intentInterviewQuestions[index];
    setStep(index);
    setResponse(answers[question.key]);
    setEditing(true);
  }

  function save() {
    if (!draft.validation.valid) return;
    const revision = draftRevision(draft.markdown);
    const now = new Date().toISOString();
    onSave({
      id: `IN-${String(100 + interview.title.length).padStart(3, "0")}`,
      artifactRevision: revision,
      originator: originator.displayName,
      title: interview.title,
      problem: interview.problem,
      outcome: interview.outcome,
      successMetric: interview.successMeasure,
      domainTags: ["integrations"],
      provenance: `Named originator · ${originator.displayName}`,
      duplicateKey: `originator-${revision}`,
      lastTouchedAt: now,
      decayDays: 30,
      status: "candidate",
    });
  }

  return (
    <DrawerFrame label="Guided brief authoring" onClose={onClose}>
      <header className="review-panel__header"><div><p className="eyebrow">Originator interview</p><h2>Tell me what you know</h2><p>I will provide the structure. You provide the judgment; anything uncertain stays an open question.</p></div></header>
      {!interviewComplete ? <div className="review-panel__section interview-workspace">
        <div className="interview-thread" aria-label="Intent interview transcript">
          <article className="message message--agent"><span>Intake agent</span><p>Start anywhere. I will interview backward from the brief and will not invent missing facts.</p></article>
          {intentInterviewQuestions.slice(0, step).map((question, index) => <div className="message-pair" key={question.key}>
            <article className="message message--agent"><span>Intake agent</span><p>{question.prompt}</p></article>
            <article className="message message--human"><span>You</span><p>{answers[question.key]}</p><button onClick={() => editAnswer(index)} type="button">Correct answer</button></article>
          </div>)}
          {currentQuestion ? <article className="message message--agent message--current"><span>Intake agent · {step + 1} of {intentInterviewQuestions.length}</span><p>{currentQuestion.prompt}</p><small>{currentQuestion.help}</small></article> : null}
        </div>
        <label className="interview-answer"><span>Your answer</span><textarea autoFocus onChange={(event) => setResponse(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submitAnswer(); }} rows={4} value={response} /></label>
        {currentQuestion?.key === "systems" ? <p className="context-hint">Pilot context can resolve: {pilotSystemContext.join(" · ")}</p> : null}
        <div className="interview-actions"><small>Press ⌘ Enter to continue.</small><button className="primary-button" disabled={!response.trim()} onClick={submitAnswer} type="button">{editing ? "Apply correction" : step === intentInterviewQuestions.length - 1 ? "Render draft" : "Continue interview"}</button></div>
      </div> : <>
        <div className="review-panel__section draft-render">
          <div className="evidence-heading"><p className="section-label">Rendered brief</p><span className={`evidence-badge ${draft.validation.valid ? "" : "evidence-badge--waiting"}`}>{draft.validation.valid ? "Complete template" : "Needs clarification"}</span></div>
          <article className="draft-title"><span>Draft brief</span><h3>{interview.title || "Untitled intent"}</h3><p>Originator · {originator.displayName}</p></article>
          {[
            ["Problem", interview.problem, 1],
            ["Proposed outcome", interview.outcome, 3],
            ["Success signal", interview.successMeasure || "Open question", 4],
            ["Affected users", interview.users.join(" · ") || "Open question", 2],
            ["Resolved systems", interview.resolvedSystems.join(" · ") || "Open question", 5],
            ["Constraints", interview.constraints.join(" · ") || "None stated", 6],
          ].map(([label, value, index]) => <article className="draft-section" key={String(label)}><header><span>{label}</span><button onClick={() => editAnswer(Number(index))} type="button">Correct</button></header><p>{value}</p></article>)}
          <article className="draft-section draft-section--questions"><header><span>Open questions</span><button onClick={() => editAnswer(7)} type="button">Correct</button></header>{interview.openQuestions.length ? <ul>{interview.openQuestions.map((question) => <li key={question}>{question}</li>)}</ul> : <p>None surfaced.</p>}</article>
          {interview.unresolvedSystems.length ? <p className="resolution-warning">Unverified system names were moved to Open Questions instead of being written as facts.</p> : null}
        </div>
        <div className="review-panel__section scope-check" data-status={scope.status}>
        <div className="evidence-heading"><p className="section-label">Scope check</p><span className={`evidence-badge ${scope.rightSized ? "" : "evidence-badge--waiting"}`}>{scope.rightSized ? "Right-sized for Frame" : scope.status === "split-at-engineer" ? "Plan-sprawl alarm" : "Split before Gate 1"}</span></div>
        <div className="scope-rule-grid">
          <span data-pass={Boolean(interview.outcome)}><b>{interview.outcome ? "✓" : "○"}</b>One outcome</span>
          <span data-pass={examWritable}><b>{examWritable ? "✓" : "○"}</b>One exam</span>
          <span data-pass={coherentShape}><b>{coherentShape ? "✓" : "○"}</b>One shape</span>
        </div>
        {!scope.rightSized ? <p>Suggested split lines: {scope.suggestedSplitLines.join(" · ")}. This is an ambiguity check, not an effort estimate.</p> : <p>Scope can freeze at Gate 1. New wants return as a revision or a new brief.</p>}
        <fieldset className="scope-fields"><legend>Can this stay one brief?</legend>
          <label className="check-field"><input checked={examWritable} onChange={(event) => setExamWritable(event.target.checked)} type="checkbox" /><span>I can describe one crisp, independently authored exam.</span></label>
          <label className="check-field"><input checked={coherentShape} onChange={(event) => setCoherentShape(event.target.checked)} type="checkbox" /><span>The Critic can review this as one coherent shape.</span></label>
        </fieldset>
        </div>
      </>}
      <footer className="review-panel__footer"><p>Save commits the rendered draft under {originator.displayName}'s identity. The underlying artifact stays behind the intent-home seam.</p><button className="primary-button" disabled={!interviewComplete || !draft.validation.valid} onClick={save} type="button">Commit accepted draft</button></footer>
    </DrawerFrame>
  );
}

function IntentDetailPanel({ allIntents, displayedRevision, inFlightCount, intent, onAction, onBack, onClose, onExternalExit, onNavigate }: {
  allIntents: ProjectedIntent[];
  displayedRevision: string;
  inFlightCount: number;
  intent: ProjectedIntent;
  onAction: (action: DetailAction, detail?: { members?: string[]; question?: string; reason?: string }) => DetailActionResult;
  onBack?: () => void;
  onClose: () => void;
  onExternalExit: () => void;
  onNavigate: (intentId: string) => void;
}) {
  const [declineReason, setDeclineReason] = useState("");
  const [declineCategory, setDeclineCategory] = useState("");
  const [question, setQuestion] = useState("");
  const [mergePreviewOpen, setMergePreviewOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const clusterMembers = (intent.clusterMemberIds ?? []).map((id) => allIntents.find((candidate) => candidate.id === id)).filter((candidate): candidate is ProjectedIntent => Boolean(candidate));
  const [selectedMembers, setSelectedMembers] = useState<string[]>(() => clusterMembers.map((member) => member.id));
  const mergePreview = previewMergedIntent(intent, clusterMembers.filter((member) => selectedMembers.includes(member.id)));
  const revision = intent.artifactRevision ?? `intent-${intent.id.toLowerCase()}`;
  const capacityAvailable = pullDisposition(inFlightCount, pilotWipLimit).allowed;
  const sourceUrl = `https://github.com/idrissenayat/steer-platform/blob/codex/phase-1-foundation/${intent.artifactPath ?? "intent/intent-detail-view.md"}`;

  useEffect(() => {
    setDeclineReason("");
    setDeclineCategory("");
    setQuestion("");
    setMergePreviewOpen(false);
    setNotice(null);
    setSelectedMembers(clusterMembers.map((member) => member.id));
  }, [intent.id]);

  function act(action: DetailAction, detail?: { members?: string[]; question?: string; reason?: string }) {
    const result = onAction(action, detail);
    if (!result.ok) setNotice(result.message);
  }

  function EvidenceBlock() {
    const evidence = intent.provenanceEvidence;
    if (!evidence) return <p className="detail-copy">{intent.provenance}</p>;
    if (evidence.kind === "band-breach") return <div className="provenance-card"><strong>{evidence.band}</strong><p>{evidence.observed} observed against a {evidence.threshold} threshold.</p><a href={evidence.windowHref}>View {evidence.windowLabel}</a></div>;
    if (evidence.kind === "ticket-cluster") return <div className="provenance-card"><strong>{evidence.count} related signals</strong><p>{evidence.sources.join(" · ")}</p><ol>{evidence.excerpts.slice(0, 3).map((excerpt) => <li key={excerpt}>“{excerpt}”</li>)}</ol></div>;
    return <div className="provenance-card"><strong>{evidence.identity}</strong><p>Provided through {evidence.channel}.</p></div>;
  }

  return (
    <DrawerFrame label={`${intent.title} intent detail`} onClose={onClose} wide>
      <header className="review-panel__header intent-detail__header">
        <div>
          <p className="eyebrow">{intent.id} · {intent.status === "expired" ? "Expired candidate" : "Candidate · not pulled"}</p>
          <h2>{intent.title}</h2>
          <p>{intent.originator ? `${intent.originator}${intent.originatorChannel ? ` · ${intent.originatorChannel}` : ""}` : "Originator not named"} · rendered version {revision}</p>
          <div className="intent-detail__header-actions">{onBack ? <button onClick={onBack} type="button">← Back to previous intent</button> : null}<a href={sourceUrl} onClick={onExternalExit} rel="noreferrer" target="_blank">Open source file <span>· leaves workspace ↗</span></a></div>
        </div>
      </header>
      {notice ? <div className="detail-notice" role="status"><strong>Action not applied</strong><span>{notice}</span>{displayedRevision !== revision ? <span>The panel refreshed from {displayedRevision} to {revision}.</span> : null}</div> : null}

      <section className="review-panel__section" data-detail-section="problem"><p className="section-label">Problem</p><p className="detail-copy detail-copy--lead">{intent.problem}</p></section>
      <section className="review-panel__section" data-detail-section="outcome"><p className="section-label">Proposed outcome</p><p className="outcome-copy">{intent.outcome}</p></section>
      <section className="review-panel__section" data-detail-section="outcome-contract">
        <div className="evidence-heading"><p className="section-label">Outcome contract</p><span className={intent.measurableToday ? "evidence-badge" : "evidence-badge evidence-badge--waiting"}>{intent.measurableToday ? "Measurable today" : "Needs resolution"}</span></div>
        <dl className="detail-facts"><div><dt>Primary metric</dt><dd>{intent.outcomeContract?.primaryMetric ?? intent.successMetric ?? "Not specified"}</dd></div>{intent.outcomeContract?.baseline ? <div><dt>Baseline</dt><dd>{intent.outcomeContract.baseline}</dd></div> : null}{intent.outcomeContract?.target ? <div><dt>Target</dt><dd>{intent.outcomeContract.target}</dd></div> : null}{intent.outcomeContract?.observationWindow ? <div><dt>Window</dt><dd>{intent.outcomeContract.observationWindow}</dd></div> : null}{intent.outcomeContract?.missing ? <div className="detail-facts__missing"><dt>Still missing</dt><dd>{intent.outcomeContract.missing}</dd></div> : null}</dl>
      </section>
      {intent.constraints?.length ? <section className="review-panel__section" data-detail-section="constraints"><p className="section-label">Constraints</p><ul className="detail-list">{intent.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul></section> : null}
      <section className="review-panel__section" data-detail-section="domains"><p className="section-label">Domain tags and review route</p><div className="tag-row">{intent.domainTags.map((domain) => <span className="domain-tag" key={domain}>{domain}</span>)}</div><p className="detail-route">{intent.domainTags.includes("accessibility") ? "Accessibility is active: a specialist seat is required at Gate 2 and Gate 3." : "Default-open route: specialist seats activate only when a tagged risk domain requires them."}</p></section>
      {intent.affectedUsers?.length || intent.systems?.length ? <section className="review-panel__section" data-detail-section="affected-users-systems"><p className="section-label">Affected users and systems</p><div className="detail-columns">{intent.affectedUsers?.length ? <div><strong>People</strong><ul>{intent.affectedUsers.map((user) => <li key={user}>{user}</li>)}</ul></div> : null}{intent.systems?.length ? <div><strong>Systems</strong><ul>{intent.systems.map((system) => <li key={system}>{system}</li>)}</ul></div> : null}</div></section> : null}
      {intent.openQuestions?.length ? <section className="review-panel__section" data-detail-section="open-questions"><p className="section-label">Open questions · {intent.openQuestions.length}</p><ol className="detail-list detail-list--questions">{intent.openQuestions.map((openQuestion) => <li key={openQuestion}>{openQuestion}</li>)}</ol></section> : null}
      <section className="review-panel__section" data-detail-section="provenance"><p className="section-label">Provenance evidence</p><EvidenceBlock /></section>
      {clusterMembers.length ? <section className="review-panel__section" data-detail-section="cluster-members"><p className="section-label">Cluster members</p><div className="cluster-member-list">{clusterMembers.map((member) => <button key={member.id} onClick={() => onNavigate(member.id)} type="button"><span>{member.id}</span><strong>{member.title}</strong><small>Open in this panel →</small></button>)}</div></section> : null}
      {intent.revisionHistory?.length ? <section className="review-panel__section" data-detail-section="revision-history"><p className="section-label">Revision history</p><ol className="revision-list">{[...intent.revisionHistory].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((entry) => <li key={entry.revision}><code>{entry.revision}</code><div><strong>{entry.firstChangedLine}</strong><span>{entry.author} · {formatDue(entry.timestamp)}</span></div></li>)}</ol></section> : null}

      <footer className="review-panel__footer intent-detail__footer">
        <div className="detail-action detail-action--pull"><div><strong>Pull into flight</strong><span>{inFlightCount} of {pilotWipLimit} live slots are occupied.</span></div><button className="primary-button" disabled={!capacityAvailable || intent.status !== "candidate"} onClick={() => act("pull")} type="button">Pull into flight · {inFlightCount}/{pilotWipLimit} slots</button>{!capacityAvailable ? <small>Capacity must open before this candidate can cross the pull boundary.</small> : null}</div>
        <div className="detail-action"><div><strong>Decline</strong><span>Keep the signal and record why it will not move forward.</span></div><select aria-label="Optional decline category" onChange={(event) => setDeclineCategory(event.target.value)} value={declineCategory}><option value="">Optional category</option><option value="off-mission">Off mission</option><option value="duplicate">Duplicate signal</option><option value="insufficient-evidence">Insufficient evidence</option></select><textarea aria-label="Decline reason" onChange={(event) => setDeclineReason(event.target.value)} placeholder="Required reason" rows={2} value={declineReason} /><button className="secondary-button" disabled={!declineReason.trim()} onClick={() => act("decline", { reason: `${declineCategory ? `${declineCategory}: ` : ""}${declineReason}` })} type="button">Decline with reason</button></div>
        <div className="detail-action"><div><strong>Merge cluster</strong><span>Preview the surviving intent and members before confirming.</span></div>{clusterMembers.length ? <div className="merge-picker">{clusterMembers.map((member) => <label key={member.id}><input checked={selectedMembers.includes(member.id)} onChange={(event) => setSelectedMembers((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))} type="checkbox" />{member.id} · {member.title}</label>)}</div> : <small>No cluster members are available.</small>}{mergePreviewOpen ? <div className="merge-preview"><span>Merge preview</span><strong>{mergePreview.title}</strong><p>{mergePreview.outcome}</p><small>Members: {mergePreview.memberIds.join(" · ") || "none selected"}</small><div><button className="secondary-button" onClick={() => setMergePreviewOpen(false)} type="button">Cancel</button><button className="primary-button" disabled={!selectedMembers.length} onClick={() => act("merge", { members: selectedMembers })} type="button">Confirm merge</button></div></div> : <button className="secondary-button" disabled={!selectedMembers.length} onClick={() => setMergePreviewOpen(true)} type="button">Preview merge</button>}</div>
        <div className="detail-action"><div><strong>Send back one question</strong><span>Ask for one missing judgment without turning the candidate into work.</span></div><textarea aria-label="Question for originator" onChange={(event) => setQuestion(event.target.value)} placeholder="What single question must the originator answer?" rows={2} value={question} /><button className="secondary-button" disabled={!question.trim()} onClick={() => act("send-back", { question })} type="button">Send one question</button></div>
      </footer>
    </DrawerFrame>
  );
}

const roleCandidateContent: Record<Role, { title: string; note: string }> = {
  "product-lead": { title: "Intent backlog", note: "Candidates awaiting a pull decision." },
  "tech-lead": { title: "Exams awaiting draft review", note: "Candidate exams surface when a review trigger fires." },
  "product-designer": { title: "Design passes pending", note: "User-facing candidates awaiting design judgment." },
  "platform-engineer": { title: "Fleet and hook changes queued", note: "Configuration candidates remain eval-gated." },
  specialist: { title: "Tagged domain reviews", note: "Only candidates carrying your risk domain appear here." },
};

function CandidatePane({ inFlightCount, intents, onOpen, role }: {
  inFlightCount: number;
  intents: ProjectedIntent[];
  onOpen: (intent: ProjectedIntent) => void;
  role: Role;
}) {
  const content = roleCandidateContent[role];
  return (
    <section className="candidate-section" id="intent-backlog">
      <div className="section-heading"><div><p className="eyebrow">Future · pull trigger only</p><h2>{content.title}</h2><p>{content.note}</p></div><span className="capacity-pill">{inFlightCount} of {pilotWipLimit} WIP slots in flight</span></div>
      {role === "product-lead" ? <div className="intent-grid">
        {intents.length ? intents.map((intent) => <article className="intent-card" key={intent.id}>
          <header><div><span>{intent.id}</span><h3>{intent.title}</h3></div><span className={intent.measurableToday ? "measure-badge" : "measure-badge measure-badge--waiting"}>{intent.measurableToday ? "Measurable today" : "Metric unresolved"}</span></header>
          <p>{intent.problem}</p>
          <div className="intent-outcome"><small>Proposed outcome</small><strong>{intent.outcome}</strong></div>
          <dl><div><dt>Mission fit</dt><dd>{intent.missionOutcome ?? "Moves no current mission outcome"}</dd></div><div><dt>Provenance</dt><dd>{intent.provenance}</dd></div></dl>
          <div className="tag-row">{intent.domainTags.map((domain) => <span className="domain-tag" key={domain}>{domain}</span>)}{intent.duplicateCount > 1 ? <span className="cluster-badge">{intent.duplicateCount} in cluster</span> : null}</div>
          <button className="intent-card__open" onClick={() => onOpen(intent)} type="button">Open full brief <span aria-hidden="true">→</span></button>
        </article>) : <div className="empty-state"><span aria-hidden="true">✓</span><h3>No triggered candidates</h3><p>The backlog remains quiet until capacity opens or a high-signal intent arrives.</p></div>}
      </div> : <article className="role-candidate-card"><span>{roleLabels[role]} lens</span><h3>{content.title}</h3><p>{content.note} This pane stays quiet unless its trigger fires.</p></article>}
    </section>
  );
}

export default function App() {
  const [chain, setChain] = useState<WorkItemChain[]>(() => structuredClone(demoChain));
  const [intents, setIntents] = useState<IntentCandidate[]>(() => structuredClone(demoIntents));
  const [role, setRole] = useState<Role>("product-lead");
  const [gateFilter, setGateFilter] = useState<"all" | Gate>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DecisionCard | null>(null);
  const [threadItem, setThreadItem] = useState<ProjectedWorkItem | null>(null);
  const [composing, setComposing] = useState(false);
  const [detailIntentId, setDetailIntentId] = useState<string | null>(null);
  const [displayedDetailRevision, setDisplayedDetailRevision] = useState("");
  const [detailHistory, setDetailHistory] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [globalGlossaryTerm, setGlobalGlossaryTerm] = useState<string | null>(null);
  const [, setDetailEvents] = useState<DetailActionEvent[]>([]);
  const [, setHubEvents] = useState<HubEvent[]>([]);
  const detailOpenedAt = useRef(0);
  const detailSessionId = useRef(`detail-${Math.random().toString(36).slice(2)}`);
  const model = useMemo(() => buildReadModel(chain, demoAsOf), [chain]);
  const projectedIntents = useMemo(() => projectIntentBacklog(intents, demoAsOf, pilotMetrics), [intents]);
  const activeIntents = projectedIntents.filter((intent) => intent.status === "candidate");
  const detailIntent = detailIntentId ? projectedIntents.find((intent) => intent.id === detailIntentId) : undefined;
  const roleDecisions = decisionsForRole(model, role);
  const visibleDecisions = roleDecisions.filter((decision) => (gateFilter === "all" || decision.gate === gateFilter) && `${decision.itemId} ${decision.title} ${decision.summary}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedItem = selected ? model.items.find((item) => item.id === selected.itemId) : undefined;
  const actor: IdentityContext = { subject: `pilot|${role}`, displayName: actorNames[role], roles: [role] };
  const modalOpen = Boolean(selected || threadItem || composing || detailIntent || globalGlossaryTerm);
  const stageCounts = model.items.reduce<Record<FlightStage, number>>((counts, item) => ({ ...counts, [item.stage]: counts[item.stage] + 1 }), { sense: 0, "frame-intent": 0, "frame-exam": 0, engineer: 0, evaluate: 0, release: 0, observe: 0, learn: 0 });
  const agingCounts = model.items.reduce<Record<FlightStage, number>>((counts, item) => ({ ...counts, [item.stage]: counts[item.stage] + (item.aging.state === "huddle" ? 1 : 0) }), { sense: 0, "frame-intent": 0, "frame-exam": 0, engineer: 0, evaluate: 0, release: 0, observe: 0, learn: 0 });

  useEffect(() => {
    function syncDetailFromHash() {
      const match = window.location.hash.match(/^#intent-backlog\/([^/?#]+)/);
      const id = match ? decodeURIComponent(match[1]) : null;
      const candidate = id ? demoIntents.find((intent) => intent.id === id) : undefined;
      setDetailIntentId(candidate?.id ?? null);
      if (candidate) {
        setDisplayedDetailRevision(candidate.artifactRevision ?? `intent-${candidate.id.toLowerCase()}`);
        detailOpenedAt.current = Date.now();
      }
    }
    syncDetailFromHash();
    window.addEventListener("hashchange", syncDetailFromHash);
    return () => window.removeEventListener("hashchange", syncDetailFromHash);
  }, []);

  function handleAction(kind: "sign" | "send-back", note?: string) {
    if (!selected) return;
    const result = applyGateAction(chain, actor, { decisionId: selected.id, displayedRevision: selected.revision, kind, note, at: demoAsOf });
    if (!result.ok) { setFeedback(result.message); return; }
    setChain(result.chain); setSelected(null);
    setFeedback(kind === "sign" ? `Signed ${selected.revision} as ${actor.displayName}.` : "Sent back with the note attached; the gate remains unsigned.");
  }

  function saveIntent(intent: IntentCandidate) {
    setIntents((current) => [...current, intent]); setComposing(false);
    setFeedback(`${intent.id} was committed to the intent backlog. It is not a work item until a Product Lead pulls it.`);
  }

  function pullIntent(intent: ProjectedIntent) {
    const disposition = pullDisposition(model.metrics.inFlightItems, pilotWipLimit);
    if (!disposition.allowed) { setFeedback(disposition.message); return; }
    const revision = intent.artifactRevision ?? `intent-${intent.id.toLowerCase()}`;
    setChain((current) => [...current, {
      id: `FD-${intent.id.slice(3)}`,
      title: intent.title,
      summary: intent.problem,
      outcome: intent.outcome,
      riskDomains: intent.domainTags,
      userFacing: true,
      artifacts: [{ kind: "brief", path: `intent/${intent.id}/BRIEF.md`, revision, updatedAt: demoAsOf }],
      signatures: [],
      stageEnteredAt: demoAsOf,
      stageBandHours: 12,
    }]);
    setIntents((current) => current.map((candidate) => candidate.id === intent.id ? { ...candidate, status: "pulled" } : candidate));
    setFeedback(`${intent.id} crossed the pull boundary and is now a work item in flight.`);
  }

  function openIntent(intent: ProjectedIntent) {
    setDetailIntentId(intent.id);
    setDisplayedDetailRevision(intent.artifactRevision ?? `intent-${intent.id.toLowerCase()}`);
    setDetailHistory([]);
    detailOpenedAt.current = Date.now();
    window.history.replaceState(null, "", `#intent-backlog/${encodeURIComponent(intent.id)}`);
  }

  function closeIntent() {
    setDetailIntentId(null);
    setDetailHistory([]);
    window.history.replaceState(null, "", "#intent-backlog");
  }

  function navigateIntent(intentId: string) {
    if (detailIntentId) setDetailHistory((current) => [...current, detailIntentId]);
    const candidate = projectedIntents.find((intent) => intent.id === intentId);
    if (!candidate) return;
    setDetailIntentId(candidate.id);
    setDisplayedDetailRevision(candidate.artifactRevision ?? `intent-${candidate.id.toLowerCase()}`);
    detailOpenedAt.current = Date.now();
    window.history.replaceState(null, "", `#intent-backlog/${encodeURIComponent(candidate.id)}`);
  }

  function backFromIntent() {
    const previous = detailHistory.at(-1);
    if (!previous) return;
    setDetailHistory((current) => current.slice(0, -1));
    const candidate = projectedIntents.find((intent) => intent.id === previous);
    if (!candidate) return;
    setDetailIntentId(candidate.id);
    setDisplayedDetailRevision(candidate.artifactRevision ?? `intent-${candidate.id.toLowerCase()}`);
    window.history.replaceState(null, "", `#intent-backlog/${encodeURIComponent(candidate.id)}`);
  }

  function handleIntentDetailAction(action: DetailAction, detail: { members?: string[]; question?: string; reason?: string } = {}): DetailActionResult {
    if (!detailIntent) return { currentRevision: "", message: "The intent is no longer available.", ok: false, reason: "validation" };
    const currentRevision = detailIntent.artifactRevision ?? `intent-${detailIntent.id.toLowerCase()}`;
    const result = performDetailAction({
      action,
      at: demoAsOf,
      currentRevision,
      displayedRevision: displayedDetailRevision,
      durationMs: Math.max(0, Date.now() - detailOpenedAt.current),
      inFlightCount: model.metrics.inFlightItems,
      intent: detailIntent,
      members: detail.members,
      question: detail.question,
      reason: detail.reason,
      sessionId: detailSessionId.current,
      wipLimit: pilotWipLimit,
    });
    if (!result.ok) {
      if (result.reason === "stale") setDisplayedDetailRevision(result.currentRevision);
      return result;
    }
    setDetailEvents((current) => [...current, result.event]);
    if (action === "pull") pullIntent(detailIntent);
    if (action === "decline") {
      const declined = declineIntent(detailIntent, detail.reason ?? "", demoAsOf);
      setIntents((current) => current.map((candidate) => candidate.id === detailIntent.id ? declined.intent : candidate));
      setFeedback(`${detailIntent.id} was declined with a recorded reason and retained as Scout tuning input.`);
    }
    if (action === "merge") {
      setIntents((current) => current.map((candidate) => detail.members?.includes(candidate.id) ? { ...candidate, status: "declined" } : candidate));
      setFeedback(`${detailIntent.id} remains the primary candidate; ${detail.members?.join(", ")} merged into its evidence cluster.`);
    }
    if (action === "send-back") setFeedback(`${detailIntent.id}: one question was sent to ${detailIntent.originator ?? "the originator"}; the candidate remains unpulled.`);
    closeIntent();
    return result;
  }

  function fileLearnChangeIntent(page: LearnPage, section: string) {
    const sectionLabel = page.sections.find((candidate) => candidate.id === section)?.title ?? section;
    const id = `IN-L${String(intents.length + 1).padStart(3, "0")}`;
    const now = new Date().toISOString();
    const candidate: IntentCandidate = {
      id,
      artifactRevision: `learn-${page.id}-${section}`,
      originator: actor.displayName,
      originatorChannel: "Learn hub · suggest a change",
      title: `Improve ${page.title}: ${sectionLabel}`,
      problem: `A reader identified a possible correction or improvement in ${page.title}, section ${sectionLabel}.`,
      outcome: "The operational canon is corrected through its governed artifact chain and the Learn hub reflects the accepted revision.",
      domainTags: ["integrations"],
      provenance: `Named originator · ${actor.displayName} · Learn hub`,
      provenanceEvidence: { kind: "named-originator", identity: actor.displayName, channel: "Learn hub · suggest a change" },
      duplicateKey: `learn-${page.id}-${section}`,
      lastTouchedAt: now,
      decayDays: 30,
      status: "candidate",
      constraints: ["The Learn hub never edits canon content in place.", "The accepted change must keep the kit and Learn corpus versions aligned."],
      openQuestions: ["What exact wording or evidence should change?"],
      systems: [page.path, page.sourcePath],
      affectedUsers: ["STEER learners", "Agent fleet"],
      outcomeContract: { primaryMetric: "framework_version_match", target: "Learn corpus version equals the kit version" },
    };
    setIntents((current) => [...current, candidate]);
    setFeedback(`${id} was filed in the intent backlog for ${page.title} · ${sectionLabel}. The canon was not edited in place.`);
  }

  return (
    <div className="app-shell">
      {feedback ? <div className="action-feedback" role="status"><span>{feedback}</span><button aria-label="Dismiss message" onClick={() => setFeedback(null)} type="button">×</button></div> : null}
      <aside aria-hidden={modalOpen ? true : undefined} className="sidebar">
        <div className="brand"><span className="brand__mark" aria-hidden="true"><i /><i /><i /></span><div><strong>STEER</strong><span>Work Management</span></div></div>
        <div className="workspace-switcher"><span className="workspace-avatar" aria-hidden="true">SP</span><div><strong>STEER Platform</strong><span>Pilot workspace · v3</span></div><b aria-hidden="true">⌄</b></div>
        <nav aria-label="Primary navigation" className="primary-nav">
          <a aria-current="page" className="nav-item nav-item--active" href="#inbox"><InboxIcon />Decision inbox<span className="nav-count">{roleDecisions.length}</span></a>
          <a className="nav-item" href="#intent-backlog"><ChainIcon />Candidates</a>
          <a className="nav-item" href="#flight-board"><BoardIcon />Flight board</a>
          <a className="nav-item" href="#work-items"><ChainIcon />Work threads</a>
          <a className="nav-item" href="#trust"><ShieldIcon />Trust evidence</a>
          <a className="nav-item" href="#learn"><BoardIcon />Learn STEER</a>
        </nav>
        <div className="authority-card"><span>Authority boundary</span><p>Humans own intent and judgment. Every action binds identity and revision.</p></div>
        <div className="sidebar__status"><span className="status-dot" /><div><strong>Projection healthy</strong><span>Fixture connector · rebuildable</span></div></div>
      </aside>

      <main aria-hidden={modalOpen ? true : undefined} id="main-content">
        <header className="app-topbar">
          <label className="global-search"><span aria-hidden="true">⌕</span><input aria-label="Search decisions" onChange={(event) => setQuery(event.target.value)} placeholder="Search decisions, items, or revisions" type="search" value={query} /><kbd>⌘ K</kbd></label>
          <div className="top-actions"><button className="author-brief-button" onClick={() => setComposing(true)} type="button">＋ Draft a brief</button><span className="pilot-pill">Pilot identity</span></div>
        </header>

        <div className="main-content">
          <header className="topbar">
            <div><p className="eyebrow">Three surfaces · one truth</p><h1>Good afternoon. Here is where to act.</h1><p>Clear decisions, pull only against capacity, and trust the bands with everything in between.</p></div>
            <label className="role-control"><span>Viewing as</span><select value={role} onChange={(event) => { setRole(event.target.value as Role); setSelected(null); }}>
              {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
          </header>

          <section aria-label="Workspace metrics" className="metrics-grid">
            <MetricCard icon="◆" label="Your decisions" note={`${model.metrics.readyDecisions} across the pod`} tone="amber" value={String(roleDecisions.length)} />
            <MetricCard icon="▥" label="Items in flight" note="Computed, never updated by hand" tone="aqua" value={String(model.metrics.inFlightItems)} />
            <MetricCard icon="✓" label="Evidence fresh" note="Bound to displayed revisions" tone="blue" value={`${model.metrics.evidenceFreshPercent}%`} />
            <MetricCard icon="◷" label="Median gate wait" note="Pilot baseline in progress" tone="coral" value={formatWait(model.metrics.medianGateWaitHours)} />
          </section>

          <section aria-label="Glossary quick peeks" className="glossary-strip"><span>Shared STEER language</span>{["intent", "pull", "work item", "exam", "gate", "band"].map((term) => <button key={term} onClick={() => setGlobalGlossaryTerm(term)} type="button">{term}</button>)}</section>

          <section className="inbox-section" id="inbox">
            <div className="section-heading"><div><p className="eyebrow">Minimum sufficient judgment</p><h2>Decision inbox</h2><p>Only the judgments waiting on you. Everything else stays ambient.</p></div><div aria-label="Filter decisions by gate" className="filter-group" role="group">
              {(["all", 1, 2, 3] as const).map((filter) => <button aria-pressed={gateFilter === filter} className={gateFilter === filter ? "filter-chip filter-chip--active" : "filter-chip"} key={filter} onClick={() => setGateFilter(filter)} type="button">{filter === "all" ? "All" : `Gate ${filter}`}</button>)}
            </div></div>
            <div className="decision-list">{visibleDecisions.length ? visibleDecisions.map((decision) => <DecisionItem decision={decision} key={decision.id} onOpen={setSelected} />) : <div className="empty-state"><span aria-hidden="true">✓</span><h3>No decisions in this view</h3><p>Your attention is clear. The projection will surface the next judgment when it is ready.</p></div>}</div>
          </section>

          <CandidatePane inFlightCount={model.metrics.inFlightItems} intents={activeIntents} onOpen={openIntent} role={role} />

          <section className="flight-section" id="flight-board">
            <div className="section-heading section-heading--compact"><div><p className="eyebrow">Present · ambient unless a band breaches</p><h2>Flight Board</h2></div><span className="read-model-note">Rebuildable projection · historical aging bands · {model.items.length} items</span></div>
            <div className="flight-track">{(Object.keys(stageLabels) as FlightStage[]).map((stage, index) => <div className="flight-stage" key={stage}><span className="flight-stage__index">{String(index + 1).padStart(2, "0")}</span><strong>{stageLabels[stage]}</strong><span>{stageCounts[stage]} {stageCounts[stage] === 1 ? "item" : "items"}{agingCounts[stage] ? ` · ${agingCounts[stage]} aging` : ""}</span></div>)}</div>
          </section>

          <section className="work-items-section" id="work-items">
            <div className="section-heading"><div><p className="eyebrow">Brief to current state</p><h2>Work-item threads</h2><p>Artifacts, evidence, and signatures in one continuous view.</p></div></div>
            <div className="work-item-grid">{model.items.map((item) => <button className="work-item-card" key={item.id} onClick={() => setThreadItem(item)} type="button"><span>{item.id} · {stageLabels[item.stage]}</span><strong>{item.title}</strong><small>{item.artifacts.length} artifacts · {item.signatures.length} signatures</small><em data-aging={item.aging.state}>{formatWait(item.aging.ageHours)} in state{item.aging.state === "huddle" ? " · huddle" : ""}</em><b aria-hidden="true">→</b></button>)}</div>
          </section>

          <section className="principle-strip" id="trust"><div className="principle-strip__mark"><ChainIcon /></div><div><p className="eyebrow">Iron rule</p><h2>The platform projects truth. It never owns it.</h2><p>Destroy the cache, replay the artifact chain, and the same workspace returns.</p></div><code>BRIEF → SPEC → EXAM → PLAN → evidence</code></section>

          <LearnHub onEvent={(event) => setHubEvents((current) => [...current, event])} onSuggestChange={fileLearnChangeIntent} role={role} />
        </div>
      </main>

      {selected && selectedItem ? <ReviewPanel decision={selected} item={selectedItem} onAction={handleAction} onClose={() => setSelected(null)} /> : null}
      {threadItem ? <WorkItemPanel item={threadItem} onClose={() => setThreadItem(null)} /> : null}
      {composing ? <BriefComposer onClose={() => setComposing(false)} onSave={saveIntent} originator={actor} /> : null}
      {detailIntent ? <IntentDetailPanel allIntents={projectedIntents} displayedRevision={displayedDetailRevision} inFlightCount={model.metrics.inFlightItems} intent={detailIntent} onAction={handleIntentDetailAction} onBack={detailHistory.length ? backFromIntent : undefined} onClose={closeIntent} onExternalExit={() => setDetailEvents((current) => recordExternalExit(current, { at: demoAsOf, durationMs: Math.max(0, Date.now() - detailOpenedAt.current), intentId: detailIntent.id, revision: detailIntent.artifactRevision ?? `intent-${detailIntent.id.toLowerCase()}`, sessionId: detailSessionId.current }))} onNavigate={navigateIntent} /> : null}
      {globalGlossaryTerm ? <GlossaryPeek onClose={() => setGlobalGlossaryTerm(null)} term={globalGlossaryTerm} /> : null}
    </div>
  );
}
