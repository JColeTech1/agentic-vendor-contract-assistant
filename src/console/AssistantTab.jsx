// ───────── Assistant tab — Conversations · Chat · Review & Timers ─────────
import { Logo as A_Logo, Badge as A_Badge, Chip as A_Chip, Button as A_Button, Citation as A_Citation, PlanStep as A_PlanStep, Countdown as A_Countdown, SectionLabel as A_SectionLabel } from "./ui.jsx";
import * as AD from "./data.js";
import { ConversationsRail as A_Rail } from "./ConversationsRail.jsx";
import { ReviewDetail } from "./KnowledgeBaseTab.jsx";
import React, { useState as aUseState, useEffect as aUseEffect, useRef as aUseRef } from "react";

const WF_LABEL = { list: "List", kanban: "Kanban", agile: "Sprint", timeline: "Timeline" };
const railLS = () => { try { return localStorage.getItem("cci-rail") === "1"; } catch (e) { return false; } };

function ReviewCard({ r, onAsk, onOpen, added, autoPilot, filed, onOpenDraft, onDelete }) {
  const [open, setOpen] = aUseState(false);
  const tone = filed ? "var(--ok)" : r.priority === "urgent" ? "var(--urgent)" : r.priority === "warn" ? "var(--warn)" : "var(--text-muted)";
  return (
    <div onClick={() => setOpen((o) => !o)} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: `3px solid ${tone}`, borderRadius: "var(--radius)", padding: "10px 12px", cursor: "pointer", transition: "all var(--dur-fast)", opacity: filed ? 0.66 : 1, animation: added ? "ds-pulse 2s ease-out" : "none" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.borderLeftColor = tone; e.currentTarget.style.background = "var(--surface-3)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.borderLeftColor = tone; e.currentTarget.style.background = "var(--surface-2)"; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.vendor}</span>
        {r.source === "agent" && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", background: "var(--accent-glow)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>✦ agent</span>}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <A_Badge status={filed ? "ok" : r.priority === "urgent" ? "urgent" : r.priority === "warn" ? "warn" : "muted"}>{filed ? "✓ Notice filed" : r.label}</A_Badge>
          {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(r.id); }} title="Remove from queue" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, lineHeight: 1, padding: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--urgent)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>✕</button>}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{filed ? "filed by auto-pilot" : r.days < 0 ? "deadline passed" : "time to act"}</span>
        {!filed && <A_Countdown to={r.deadline} compact />}
      </div>
      {!filed && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); onAsk(r.question); }} style={{ fontSize: 10.5, color: "var(--accent)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>Ask agent →</button>
          {autoPilot && r.priority === "urgent" && (
            <button onClick={(e) => { e.stopPropagation(); onOpenDraft(r); }} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-primary)", background: "var(--surface-4)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "2px 9px", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; }}>📝 Review draft</button>
          )}
        </div>
      )}
      {open && <ReviewDetail item={r} />}
    </div>
  );
}

function ReviewGroup({ title, items, tone, addedId, cardProps }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: tone || "var(--text-muted)" }}>
        {title}<span style={{ background: "var(--surface-4)", color: "var(--text-secondary)", borderRadius: "var(--radius-pill)", padding: "0 7px", fontSize: 10 }}>{items.length}</span>
      </div>
      {items.map((r) => <ReviewCard key={r.id} r={r} added={r.id === addedId} filed={cardProps.filedIds.has(r.id)} {...cardProps} />)}
    </div>
  );
}

function ReviewSidebar({ items, workflow, alertMode, addedId, filedIds, onAsk, onOpen, onOpenSettings, onOpenDraft, onDelete }) {
  const autoPilot = alertMode === "auto";
  const cardProps = { onAsk, onOpen, onOpenDraft, onDelete, autoPilot, filedIds };
  let body;
  if (workflow === "kanban") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ReviewGroup title="Act now" items={items.filter((r) => r.priority === "urgent")} tone="var(--urgent)" addedId={addedId} cardProps={cardProps} />
        <ReviewGroup title="Notice window open" items={items.filter((r) => r.priority === "warn")} tone="var(--warn)" addedId={addedId} cardProps={cardProps} />
        <ReviewGroup title="Upcoming" items={items.filter((r) => r.priority !== "urgent" && r.priority !== "warn")} addedId={addedId} cardProps={cardProps} />
      </div>
    );
  } else if (workflow === "agile") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ReviewGroup title="This sprint · next 14 days" items={items.filter((r) => r.days <= 14)} tone="var(--accent)" addedId={addedId} cardProps={cardProps} />
        <ReviewGroup title="Backlog" items={items.filter((r) => r.days > 14)} addedId={addedId} cardProps={cardProps} />
      </div>
    );
  } else if (workflow === "timeline") {
    let last = null;
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {items.map((r) => {
          const m = new Date(r.deadline).toLocaleDateString("en-US", { month: "long", year: "numeric" });
          const head = m !== last; last = m;
          return (
            <React.Fragment key={r.id}>
              {head && <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginTop: 6 }}>{m}</div>}
              <ReviewCard r={r} added={r.id === addedId} filed={filedIds.has(r.id)} {...cardProps} />
            </React.Fragment>
          );
        })}
      </div>
    );
  } else {
    body = <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{items.map((r) => <ReviewCard key={r.id} r={r} added={r.id === addedId} filed={filedIds.has(r.id)} {...cardProps} />)}</div>;
  }

  const urgentCount = items.filter((r) => r.priority === "urgent" && !filedIds.has(r.id)).length;
  return (
    <aside style={{ width: 320, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--surface)", overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <A_SectionLabel count={urgentCount ? `${urgentCount} urgent` : null}>Review queue · {items.length}</A_SectionLabel>
        <button onClick={onOpenSettings} title="Workflow settings" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: 2 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>⚙</button>
      </div>
      <div style={{ fontSize: 11, color: autoPilot ? "var(--accent)" : "var(--text-muted)", marginTop: -4 }}>{WF_LABEL[workflow]} view · {autoPilot ? "✦ Auto-pilot drafting notices" : "Manual review"}</div>
      {items.length === 0
        ? <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 4 }}>Your queue is empty. Ask about your contracts, then <b style={{ color: "var(--text-secondary)" }}>+ Add to queue</b> the agent's recommended actions to track their deadlines here.</div>
        : body}
    </aside>
  );
}

// ───────── Drafted-notice approval modal ─────────
function NoticeDraftModal({ item, onApprove, onClose }) {
  if (!item) return null;
  const text = AD.draftNotice(item.id);
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(8,10,16,0.55)", display: "grid", placeItems: "center", zIndex: 50, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "100%", background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", boxShadow: "var(--glow-accent)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", background: "var(--accent-glow)", borderRadius: 4, padding: "2px 6px" }}>✦ AUTO-PILOT</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Drafted notice — {item.vendor}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 18 }}>
          <pre style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", whiteSpace: "pre-wrap", margin: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", maxHeight: 320, overflowY: "auto" }}>{text}</pre>
        </div>
        <div style={{ padding: "0 18px 18px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <A_Button variant="ghost" onClick={onClose}>Cancel</A_Button>
          <A_Button variant="primary" onClick={() => onApprove(item.id)}>Approve &amp; file notice</A_Button>
        </div>
      </div>
    </div>
  );
}

// ───────── Chat ─────────
function RecoBlock({ recos, isAdded, onAddReco, autoPilot }) {
  const [dismissed, setDismissed] = aUseState(() => new Set());
  const visible = recos.filter((r) => !dismissed.has(r.id));
  if (!visible.length) return <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--text-muted)", fontStyle: "italic" }}>All recommendations handled.</div>;
  return (
    <div style={{ marginTop: 4, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "var(--accent)" }}>✦</span> Recommended actions{autoPilot && <span style={{ color: "var(--accent)", fontWeight: 700, letterSpacing: 0 }}>· auto-pilot on</span>}</div>
      {visible.map((r) => {
        const added = isAdded(r.id);
        const auto = autoPilot && r.priority === "urgent";
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: r.priority === "urgent" ? "var(--urgent)" : r.priority === "warn" ? "var(--warn)" : "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-secondary)" }}>{r.label}</span>
            <button disabled={added} onClick={() => onAddReco(r)} style={{ flexShrink: 0, fontFamily: "var(--font)", fontSize: 11, fontWeight: 600, borderRadius: "var(--radius-pill)", padding: "4px 11px", cursor: added ? "default" : "pointer", border: `1px solid ${added ? "var(--ok-border)" : "var(--border-strong)"}`, background: added ? "var(--ok-bg)" : "var(--surface-3)", color: added ? "var(--ok)" : "var(--text-primary)", transition: "all var(--dur-fast)" }}
              onMouseEnter={(e) => { if (!added) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; } }} onMouseLeave={(e) => { if (!added) { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; } }}>
              {added ? (auto ? "✓ Auto-added" : "✓ On your board") : "+ Add to queue"}
            </button>
            {!added && <button onClick={() => setDismissed((s) => new Set(s).add(r.id))} title="Dismiss this recommendation" style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, fontWeight: 600 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--urgent)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>Dismiss</button>}
          </div>
        );
      })}
    </div>
  );
}

function ChatMessage({ m, isAdded, onAddReco, autoPilot, showRecos }) {
  if (m.role === "user") return (
    <div style={{ alignSelf: "flex-end", maxWidth: "82%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>You</div>
      <div style={{ background: "var(--accent-glow)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", borderRadius: "var(--radius-lg)", padding: "12px 15px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-primary)" }}>{m.text}</div>
    </div>
  );
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
        vendor-contract-assistant<span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", padding: "1px 6px", borderRadius: 4, background: m.live ? "var(--ok-bg)" : "var(--surface-4)", color: m.live ? "var(--ok)" : "var(--text-secondary)" }}>{m.live ? "live" : "offline"}</span>
      </div>
      <div style={{ background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 15px", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{m.text}</div>
      {m.citations?.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{m.citations.map((c) => <A_Citation key={c}>{c}</A_Citation>)}</div>}
      {showRecos && m.recos?.length > 0 && <RecoBlock recos={m.recos} isAdded={isAdded} onAddReco={onAddReco} autoPilot={autoPilot} />}
      {m.queryPlan?.length > 0 && (
        <details style={{ marginTop: 2 }}>
          <summary style={{ fontSize: 10.5, color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--mono)", listStyle: "none" }}>▸ reasoning trace ({m.queryPlan.length} steps)</summary>
          <ol style={{ margin: "6px 0 0 4px", paddingLeft: 18 }}>{m.queryPlan.map((s, i) => <li key={i} style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--mono)", padding: "2px 0" }}>{s}</li>)}</ol>
        </details>
      )}
    </div>
  );
}

function AssistantTab({ conversations, chat, input, setInput, onSend, review, settings, memory, onOpenSettings }) {
  const { messages, loading, activePlan } = chat;
  const [railCollapsed, setRailCollapsed] = aUseState(railLS);
  const [draftItem, setDraftItem] = aUseState(null);
  const endRef = aUseRef(null);
  const taRef = aUseRef(null);
  aUseEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, loading, activePlan]);
  aUseEffect(() => { const el = taRef.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; } }, [input]);
  const toggleRail = () => setRailCollapsed((v) => { const n = !v; try { localStorage.setItem("cci-rail", n ? "1" : "0"); } catch (e) {} return n; });
  const empty = messages.length === 0 && !loading;
  const autoPilot = settings.alertMode === "auto";
  const showRecos = settings.alertMode !== "never";
  const chatTitle = conversations.convos.find((c) => c.id === conversations.activeId)?.title || "Chat";

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
      <A_Rail convos={conversations.convos} activeId={conversations.activeId} onSelect={conversations.selectChat} onNew={conversations.newChat} onDelete={conversations.deleteChat} onRename={conversations.renameChat} collapsed={railCollapsed} onToggle={toggleRail} memoryOn={memory.enabled} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--surface-2)" }}>
        <div style={{ borderBottom: "1px solid var(--border)", padding: "12px 22px", minHeight: 52 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 600 }}>{loading ? "Reasoning trace · live" : "Reasoning trace"}</div>
          {(loading ? activePlan : []).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>{activePlan.map((s, i) => <A_PlanStep key={i} index={i}>{s}</A_PlanStep>)}</div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Ask a question to see the agent decompose, retrieve from the knowledge base, and cite its sources →</div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {empty ? (
            <div style={{ margin: "auto", textAlign: "center", maxWidth: 520 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}><A_Logo size={48} /></div>
              <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.01em" }}>Ask about your vendor contracts</h2>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>Every answer is grounded in the contract corpus and comes back with the exact source files and the agent's retrieval steps. Try “add that to my to-do list” after an answer.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginTop: 20 }}>{AD.QUERY_CHIPS.map((q) => <A_Chip key={q} onClick={() => onSend(q)}>{q}</A_Chip>)}</div>
            </div>
          ) : (
            <React.Fragment>
              {messages.map((m) => <ChatMessage key={m.id} m={m} isAdded={review.hasItem} onAddReco={(r) => review.addItems([r], { sourceChat: { id: conversations.activeId, title: chatTitle }, answerExcerpt: (m.text || "").slice(0, 220) })} autoPilot={autoPilot} showRecos={showRecos} />)}
              {loading && (
                <div style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>vendor-contract-assistant</div>
                  <div style={{ background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 15px", fontSize: 12, color: "var(--text-muted)", display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <span className="cci-typing"><span /><span /><span /></span> retrieving from kb-contracts
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </React.Fragment>
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 22px" }}>
          <div className="cci-input" style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "var(--surface-3)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", padding: "10px 14px" }}>
            <textarea ref={taRef} rows={1} value={input} placeholder="Ask about renewals, escalations, data obligations… or “add that to my to-do list”" onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(input); } }}
              style={{ flex: 1, background: "none", border: "none", outline: "none", resize: "none", color: "var(--text-primary)", fontFamily: "inherit", fontSize: 13.5, maxHeight: 120, lineHeight: 1.5 }} />
            <A_Button variant="primary" iconOnly disabled={!input.trim() || loading} onClick={() => onSend(input)} aria-label="Send">➤</A_Button>
          </div>
        </div>
      </div>

      <ReviewSidebar items={review.items} workflow={settings.workflow} alertMode={settings.alertMode} addedId={review.addedId} filedIds={review.filedIds} onAsk={onSend} onOpen={() => {}} onOpenSettings={onOpenSettings} onOpenDraft={setDraftItem} onDelete={review.removeItem} />

      <NoticeDraftModal item={draftItem} onApprove={(id) => { review.fileNotice(id); setDraftItem(null); }} onClose={() => setDraftItem(null)} />
    </div>
  );
}

export { AssistantTab };
