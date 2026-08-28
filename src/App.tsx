import { useEffect, useMemo, useRef, useState } from "react";
import { BoardIcon, ChainIcon, CloseIcon, InboxIcon, ShieldIcon } from "./components/Icons";
import { demoAsOf, demoChain } from "./data/demo-chain";
import { applyGateAction } from "./domain/actions";
import { draftBrief, draftRevision } from "./domain/brief-author";
import { assembleEvidence } from "./domain/evidence";
import { buildReadModel, decisionsForRole } from "./domain/read-model";
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

function DrawerFrame({ children, label, onClose }: {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
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
    <div aria-label={label} aria-modal="true" className="review-backdrop" onKeyDown={handleKeyDown} role="dialog">
      <section className="review-panel" ref={panelRef}>
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

function BriefComposer({ onClose, onSave }: { onClose: () => void; onSave: (item: WorkItemChain) => void }) {
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [outcome, setOutcome] = useState("");
  const [users, setUsers] = useState("");
  const [systems, setSystems] = useState("");
  const [constraints, setConstraints] = useState("");
  const [questions, setQuestions] = useState("");
  const split = (value: string) => value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const draft = draftBrief({ title, problem, outcome, users: split(users), systems: split(systems), constraints: split(constraints), openQuestions: split(questions) });

  function save() {
    if (!draft.validation.valid) return;
    const revision = draftRevision(draft.markdown);
    const now = new Date().toISOString();
    onSave({
      id: `FD-${String(100 + title.length).padStart(3, "0")}`,
      title: title.trim(), summary: problem.trim(), outcome: outcome.trim(),
      riskDomains: ["integrations"], userFacing: true,
      artifacts: [{ kind: "brief", path: `intent/${revision}/BRIEF.md`, revision, updatedAt: now, content: draft.markdown }],
      signatures: [],
    });
  }

  return (
    <DrawerFrame label="Guided brief authoring" onClose={onClose}>
      <header className="review-panel__header"><div><p className="eyebrow">Originator path</p><h2>Describe the problem</h2><p>No repository terminology is required. You remain the author.</p></div></header>
      <div className="brief-form review-panel__section">
        <label><span>Working title</span><input onChange={(event) => setTitle(event.target.value)} value={title} /></label>
        <label><span>What is happening?</span><textarea onChange={(event) => setProblem(event.target.value)} rows={4} value={problem} /></label>
        <label><span>What should become true?</span><textarea onChange={(event) => setOutcome(event.target.value)} rows={3} value={outcome} /></label>
        <label><span>Who is affected? <small>Separate with commas</small></span><input onChange={(event) => setUsers(event.target.value)} value={users} /></label>
        <label><span>Which systems are involved?</span><input onChange={(event) => setSystems(event.target.value)} value={systems} /></label>
        <label><span>Constraints</span><input onChange={(event) => setConstraints(event.target.value)} value={constraints} /></label>
        <label><span>Open questions</span><input onChange={(event) => setQuestions(event.target.value)} value={questions} /></label>
      </div>
      <div className="review-panel__section"><div className="evidence-heading"><p className="section-label">Draft readiness</p><span className={`evidence-badge ${draft.validation.valid ? "" : "evidence-badge--waiting"}`}>{draft.validation.valid ? "Ready for your review" : `${draft.validation.missing.length} required fields`}</span></div><pre className="brief-preview">{draft.markdown}</pre></div>
      <footer className="review-panel__footer"><p>Saving adds a revision-bound BRIEF to the configured intent-home connector.</p><button className="primary-button" disabled={!draft.validation.valid} onClick={save} type="button">Save draft to intent home</button></footer>
    </DrawerFrame>
  );
}

export default function App() {
  const [chain, setChain] = useState<WorkItemChain[]>(() => structuredClone(demoChain));
  const [role, setRole] = useState<Role>("tech-lead");
  const [gateFilter, setGateFilter] = useState<"all" | Gate>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DecisionCard | null>(null);
  const [threadItem, setThreadItem] = useState<ProjectedWorkItem | null>(null);
  const [composing, setComposing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const model = useMemo(() => buildReadModel(chain, demoAsOf), [chain]);
  const roleDecisions = decisionsForRole(model, role);
  const visibleDecisions = roleDecisions.filter((decision) => (gateFilter === "all" || decision.gate === gateFilter) && `${decision.itemId} ${decision.title} ${decision.summary}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedItem = selected ? model.items.find((item) => item.id === selected.itemId) : undefined;
  const actor: IdentityContext = { subject: `pilot|${role}`, displayName: actorNames[role], roles: [role] };
  const modalOpen = Boolean(selected || threadItem || composing);
  const stageCounts = model.items.reduce<Record<FlightStage, number>>((counts, item) => ({ ...counts, [item.stage]: counts[item.stage] + 1 }), { sense: 0, "frame-intent": 0, "frame-exam": 0, engineer: 0, evaluate: 0, release: 0, observe: 0, learn: 0 });

  function handleAction(kind: "sign" | "send-back", note?: string) {
    if (!selected) return;
    const result = applyGateAction(chain, actor, { decisionId: selected.id, displayedRevision: selected.revision, kind, note, at: demoAsOf });
    if (!result.ok) { setFeedback(result.message); return; }
    setChain(result.chain); setSelected(null);
    setFeedback(kind === "sign" ? `Signed ${selected.revision} as ${actor.displayName}.` : "Sent back with the note attached; the gate remains unsigned.");
  }

  function saveBrief(item: WorkItemChain) {
    setChain((current) => [...current, item]); setComposing(false);
    setFeedback(`${item.id} was added to the intent home as a draft BRIEF.`);
  }

  return (
    <div className="app-shell">
      {feedback ? <div className="action-feedback" role="status"><span>{feedback}</span><button aria-label="Dismiss message" onClick={() => setFeedback(null)} type="button">×</button></div> : null}
      <aside aria-hidden={modalOpen ? true : undefined} className="sidebar">
        <div className="brand"><span className="brand__mark" aria-hidden="true"><i /><i /><i /></span><div><strong>STEER</strong><span>Work Management</span></div></div>
        <div className="workspace-switcher"><span className="workspace-avatar" aria-hidden="true">SP</span><div><strong>STEER Platform</strong><span>Pilot workspace · v3</span></div><b aria-hidden="true">⌄</b></div>
        <nav aria-label="Primary navigation" className="primary-nav">
          <a aria-current="page" className="nav-item nav-item--active" href="#inbox"><InboxIcon />Decision inbox<span className="nav-count">{roleDecisions.length}</span></a>
          <a className="nav-item" href="#flight-board"><BoardIcon />Flight board</a>
          <a className="nav-item" href="#work-items"><ChainIcon />Work threads</a>
          <a className="nav-item" href="#trust"><ShieldIcon />Trust evidence</a>
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
            <div><p className="eyebrow">Human control tower</p><h1>Good afternoon. Here is where to act.</h1><p>Start with the next consequential judgment. The rest of the system stays ambient.</p></div>
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

          <section className="inbox-section" id="inbox">
            <div className="section-heading"><div><p className="eyebrow">Minimum sufficient judgment</p><h2>Decision inbox</h2><p>Only the judgments waiting on you. Everything else stays ambient.</p></div><div aria-label="Filter decisions by gate" className="filter-group" role="group">
              {(["all", 1, 2, 3] as const).map((filter) => <button aria-pressed={gateFilter === filter} className={gateFilter === filter ? "filter-chip filter-chip--active" : "filter-chip"} key={filter} onClick={() => setGateFilter(filter)} type="button">{filter === "all" ? "All" : `Gate ${filter}`}</button>)}
            </div></div>
            <div className="decision-list">{visibleDecisions.length ? visibleDecisions.map((decision) => <DecisionItem decision={decision} key={decision.id} onOpen={setSelected} />) : <div className="empty-state"><span aria-hidden="true">✓</span><h3>No decisions in this view</h3><p>Your attention is clear. The projection will surface the next judgment when it is ready.</p></div>}</div>
          </section>

          <section className="flight-section" id="flight-board">
            <div className="section-heading section-heading--compact"><div><p className="eyebrow">Computed from the chain</p><h2>Flight Board</h2></div><span className="read-model-note">Rebuildable projection · {model.items.length} items</span></div>
            <div className="flight-track">{(Object.keys(stageLabels) as FlightStage[]).map((stage, index) => <div className="flight-stage" key={stage}><span className="flight-stage__index">{String(index + 1).padStart(2, "0")}</span><strong>{stageLabels[stage]}</strong><span>{stageCounts[stage]} {stageCounts[stage] === 1 ? "item" : "items"}</span></div>)}</div>
          </section>

          <section className="work-items-section" id="work-items">
            <div className="section-heading"><div><p className="eyebrow">Brief to current state</p><h2>Work-item threads</h2><p>Artifacts, evidence, and signatures in one continuous view.</p></div></div>
            <div className="work-item-grid">{model.items.map((item) => <button className="work-item-card" key={item.id} onClick={() => setThreadItem(item)} type="button"><span>{item.id} · {stageLabels[item.stage]}</span><strong>{item.title}</strong><small>{item.artifacts.length} artifacts · {item.signatures.length} signatures</small><b aria-hidden="true">→</b></button>)}</div>
          </section>

          <section className="principle-strip" id="trust"><div className="principle-strip__mark"><ChainIcon /></div><div><p className="eyebrow">Iron rule</p><h2>The platform projects truth. It never owns it.</h2><p>Destroy the cache, replay the artifact chain, and the same workspace returns.</p></div><code>BRIEF → SPEC → EXAM → PLAN → evidence</code></section>
        </div>
      </main>

      {selected && selectedItem ? <ReviewPanel decision={selected} item={selectedItem} onAction={handleAction} onClose={() => setSelected(null)} /> : null}
      {threadItem ? <WorkItemPanel item={threadItem} onClose={() => setThreadItem(null)} /> : null}
      {composing ? <BriefComposer onClose={() => setComposing(false)} onSave={saveBrief} /> : null}
    </div>
  );
}
