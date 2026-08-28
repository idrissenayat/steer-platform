import { useEffect, useMemo, useRef, useState } from "react";
import { BoardIcon, ChainIcon, CloseIcon, InboxIcon, ShieldIcon } from "./components/Icons";
import { demoAsOf, demoChain } from "./data/demo-chain";
import { buildReadModel, decisionsForRole } from "./domain/read-model";
import type { DecisionCard, FlightStage, Gate, Role } from "./domain/types";

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

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function DecisionItem({
  decision,
  onOpen,
}: {
  decision: DecisionCard;
  onOpen: (decision: DecisionCard) => void;
}) {
  return (
    <article className="decision-card">
      <div className="decision-card__rail" data-urgency={decision.urgency} />
      <div className="decision-card__body">
        <div className="decision-card__meta">
          <span className={`urgency urgency--${decision.urgency}`}>
            {decision.urgency === "overdue"
              ? "Overdue"
              : decision.urgency === "due-soon"
                ? "Due soon"
                : "On track"}
          </span>
          <span>Gate {decision.gate}</span>
          <span>{decision.itemId}</span>
        </div>
        <div className="decision-card__content">
          <div>
            <h3>{decision.title}</h3>
            <p>{decision.summary}</p>
          </div>
          <div className="decision-card__facts">
            <span>
              <small>Decision</small>
              {gateDescriptions[decision.gate]}
            </span>
            <span>
              <small>Due</small>
              {formatDue(decision.dueAt)}
            </span>
            <span>
              <small>Revision</small>
              <code>{decision.revision}</code>
            </span>
          </div>
        </div>
      </div>
      <button className="review-button" onClick={() => onOpen(decision)} type="button">
        Review decision
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function ReviewPanel({ decision, onClose }: { decision: DecisionCard; onClose: () => void }) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], select"),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      aria-labelledby="review-title"
      aria-modal="true"
      className="review-backdrop"
      onKeyDown={handleKeyDown}
      role="dialog"
    >
      <section className="review-panel" ref={panelRef}>
        <header className="review-panel__header">
          <div>
            <p className="eyebrow">{decision.itemId} · Gate {decision.gate}</p>
            <h2 id="review-title">{decision.title}</h2>
          </div>
          <button
            aria-label="Close review"
            className="icon-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="review-panel__section review-panel__lead">
          <span className="status-dot" />
          <div>
            <strong>Ready for {roleLabels[decision.role]}</strong>
            <p>{gateDescriptions[decision.gate]} · revision {decision.revision}</p>
          </div>
        </div>

        <div className="review-panel__section">
          <p className="section-label">Outcome contract</p>
          <p className="outcome-copy">{decision.outcome}</p>
        </div>

        <div className="review-panel__section">
          <div className="evidence-heading">
            <p className="section-label">Evidence posture</p>
            <span className="evidence-badge">
              <ShieldIcon />
              {decision.evidenceState === "fresh" ? "Fresh at revision" : "Not yet required"}
            </span>
          </div>
          <ul className="evidence-list">
            <li>Artifact revision is bound to the decision.</li>
            <li>Required prior signatures are present.</li>
            <li>No signing action is enabled in this foundation slice.</li>
          </ul>
        </div>

        <div className="review-panel__section">
          <p className="section-label">Risk domains</p>
          <div className="tag-row">
            {decision.riskDomains.map((domain) => (
              <span className="domain-tag" key={domain}>{domain}</span>
            ))}
          </div>
        </div>

        <footer className="review-panel__footer">
          <p>This prototype is read-only. Gate writes remain intentionally disabled.</p>
          <button className="secondary-button" onClick={onClose} type="button">Return to inbox</button>
        </footer>
      </section>
    </div>
  );
}

export default function App() {
  const model = useMemo(() => buildReadModel(demoChain, demoAsOf), []);
  const [role, setRole] = useState<Role>("tech-lead");
  const [gateFilter, setGateFilter] = useState<"all" | Gate>("all");
  const [selected, setSelected] = useState<DecisionCard | null>(null);

  const roleDecisions = decisionsForRole(model, role);
  const visibleDecisions = roleDecisions.filter(
    (decision) => gateFilter === "all" || decision.gate === gateFilter,
  );

  const stageCounts = model.items.reduce<Record<FlightStage, number>>(
    (counts, item) => ({ ...counts, [item.stage]: counts[item.stage] + 1 }),
    {
      sense: 0,
      "frame-intent": 0,
      "frame-exam": 0,
      engineer: 0,
      evaluate: 0,
      release: 0,
      observe: 0,
      learn: 0,
    },
  );

  return (
    <div className="app-shell">
      <aside aria-hidden={selected ? true : undefined} className="sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">S</span>
          <div>
            <strong>STEER</strong>
            <span>Platform pod</span>
          </div>
        </div>

        <nav aria-label="Primary navigation" className="primary-nav">
          <a aria-current="page" className="nav-item nav-item--active" href="#inbox">
            <InboxIcon />
            Decision inbox
            <span className="nav-count">{roleDecisions.length}</span>
          </a>
          <a className="nav-item" href="#flight-board"><BoardIcon />Flight board</a>
          <a className="nav-item" href="#artifact-chain"><ChainIcon />Artifact chain</a>
          <a className="nav-item" href="#trust"><ShieldIcon />Trust ledger</a>
        </nav>

        <div className="sidebar__status">
          <span className="status-dot" />
          <div>
            <strong>Projection healthy</strong>
            <span>Fixture source · read only</span>
          </div>
        </div>
      </aside>

      <main aria-hidden={selected ? true : undefined} id="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Platform pod · Pilot workspace</p>
            <h1>Good afternoon, Idriss.</h1>
          </div>
          <label className="role-control">
            <span>Viewing as</span>
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </header>

        <section aria-label="Workspace metrics" className="metrics-grid">
          <MetricCard label="Your decisions" note={`${model.metrics.readyDecisions} across the pod`} value={String(roleDecisions.length)} />
          <MetricCard label="Items in flight" note="Computed, never updated by hand" value={String(model.metrics.inFlightItems)} />
          <MetricCard label="Evidence fresh" note="Bound to displayed revisions" value={`${model.metrics.evidenceFreshPercent}%`} />
          <MetricCard label="Median gate wait" note="Pilot baseline in progress" value={formatWait(model.metrics.medianGateWaitHours)} />
        </section>

        <section className="inbox-section" id="inbox">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Minimum sufficient judgment</p>
              <h2>Decision inbox</h2>
              <p>Only the judgments waiting on you. Everything else stays ambient.</p>
            </div>
            <div aria-label="Filter decisions by gate" className="filter-group" role="group">
              {(["all", 1, 2, 3] as const).map((filter) => (
                <button
                  aria-pressed={gateFilter === filter}
                  className={gateFilter === filter ? "filter-chip filter-chip--active" : "filter-chip"}
                  key={filter}
                  onClick={() => setGateFilter(filter)}
                  type="button"
                >
                  {filter === "all" ? "All" : `Gate ${filter}`}
                </button>
              ))}
            </div>
          </div>

          <div className="decision-list">
            {visibleDecisions.length ? (
              visibleDecisions.map((decision) => (
                <DecisionItem decision={decision} key={decision.id} onOpen={setSelected} />
              ))
            ) : (
              <div className="empty-state">
                <span aria-hidden="true">✓</span>
                <h3>No decisions in this view</h3>
                <p>Your attention is clear. The projection will surface the next judgment when it is ready.</p>
              </div>
            )}
          </div>
        </section>

        <section className="flight-section" id="flight-board">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">Computed from the chain</p>
              <h2>Flight Board</h2>
            </div>
            <span className="read-model-note">Rebuildable projection · {model.items.length} items</span>
          </div>
          <div className="flight-track">
            {(Object.keys(stageLabels) as FlightStage[]).map((stage, index) => (
              <div className="flight-stage" key={stage}>
                <span className="flight-stage__index">{String(index + 1).padStart(2, "0")}</span>
                <strong>{stageLabels[stage]}</strong>
                <span>{stageCounts[stage]} {stageCounts[stage] === 1 ? "item" : "items"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="principle-strip" id="artifact-chain">
          <div className="principle-strip__mark"><ChainIcon /></div>
          <div>
            <p className="eyebrow">Iron rule</p>
            <h2>The platform projects truth. It never owns it.</h2>
            <p>Destroy the cache, replay the artifact chain, and the same workspace returns.</p>
          </div>
          <code>BRIEF → SPEC → EXAM → PLAN → evidence</code>
        </section>
      </main>

      {selected ? <ReviewPanel decision={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
