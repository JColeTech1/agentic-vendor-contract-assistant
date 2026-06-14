// ───────── Conversations rail — chat history (new / switch / rename / delete) ─────────
import React, { useState as cvUseState, useRef as cvUseRef, useEffect as cvUseEffect } from "react";

function timeGroup(ts) {
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  if (now - d < 7 * 86400000) return "Earlier this week";
  return "Older";
}

function ConvoRow({ c, active, onSelect, onDelete, onRename }) {
  const [hover, setHover] = cvUseState(false);
  const [editing, setEditing] = cvUseState(false);
  const [draft, setDraft] = cvUseState(c.title);
  const inputRef = cvUseRef(null);
  cvUseEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);
  const commit = () => { const t = draft.trim(); onRename(c.id, t || "Untitled chat"); setEditing(false); };

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={() => onSelect(c.id)} onDoubleClick={() => { setDraft(c.title); setEditing(true); }}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: "var(--radius)", cursor: "pointer",
        background: active ? "var(--surface-3)" : hover ? "rgba(127,140,170,0.08)" : "transparent",
        border: `1px solid ${active ? "var(--border-strong)" : "transparent"}`, transition: "background var(--dur-fast)" }}>
      <span style={{ color: active ? "var(--accent)" : "var(--text-muted)", fontSize: 12, flexShrink: 0 }}>◇</span>
      {editing ? (
        <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 4, color: "var(--text-primary)", fontFamily: "inherit", fontSize: 12.5, padding: "2px 6px", outline: "none" }} />
      ) : (
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: active ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title || "New chat"}</span>
      )}
      {hover && !editing && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} title="Delete chat"
          style={{ flexShrink: 0, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 2, borderRadius: 4 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--urgent)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>✕</button>
      )}
    </div>
  );
}

function ConversationsRail({ convos, activeId, onSelect, onNew, onDelete, onRename, collapsed, onToggle, memoryOn }) {
  if (collapsed) {
    return (
      <aside style={{ width: 52, flexShrink: 0, borderRight: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 0" }}>
        <button onClick={onToggle} title="Expand conversations" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: "var(--radius)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>»</button>
        <button onClick={onNew} title="New chat" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", cursor: "pointer", color: "var(--text-primary)", fontSize: 16, width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: "var(--radius)" }}>＋</button>
        <div style={{ flex: 1 }} />
      </aside>
    );
  }
  let lastGroup = null;
  return (
    <aside style={{ width: 232, flexShrink: 0, borderRight: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <button onClick={onNew} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--text-primary)", fontFamily: "var(--font)", fontSize: 13, fontWeight: 600, padding: "9px 12px", cursor: "pointer", transition: "all var(--dur-fast)" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--surface-3)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.background = "var(--surface-2)"; }}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span> New chat
        </button>
        <button onClick={onToggle} title="Collapse" style={{ flexShrink: 0, width: 36, background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text-muted)", fontSize: 15 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>«</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 4px", display: "flex", flexDirection: "column", gap: 2 }}>
        {convos.map((c) => {
          const g = timeGroup(c.createdAt);
          const head = g !== lastGroup; lastGroup = g;
          return (
            <React.Fragment key={c.id}>
              {head && <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", fontWeight: 600, padding: "10px 10px 4px" }}>{g}</div>}
              <ConvoRow c={c} active={c.id === activeId} onSelect={onSelect} onDelete={onDelete} onRename={onRename} />
            </React.Fragment>
          );
        })}
      </div>
    </aside>
  );
}

export { ConversationsRail };
