// ───────── Knowledge Base tab — Workbook status · My to-do list · Combined · Documents ─────────
// Each lens can be viewed Flat or Grouped by category (grouping is a toggle, not its own view).
import { Badge as K_Badge, Countdown as K_Countdown } from "./ui.jsx";
import * as KD from "./data.js";
import { fetchDocument } from "../lib/foundry.js";
import React, { useState as kUseState } from "react";

const WB_LS = "cci-wb-agent";
const toNum = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };

// Read the agent's cached register (already parsed by the Workbook tab) into status rows.
function readWorkbookRows() {
  let sheets = null;
  try { sheets = JSON.parse(localStorage.getItem(WB_LS) || "null"); } catch { sheets = null; }
  const sheet = Array.isArray(sheets) ? sheets.find((s) => (s.cols || []).length) : null;
  if (!sheet) return null;
  const cols = sheet.cols.map((c) => String(c).toLowerCase());
  const idx = (...kws) => { for (const k of kws) { const i = cols.findIndex((c) => c.includes(k)); if (i >= 0) return i; } return -1; };
  const iVendor = idx("vendor"), iCat = idx("categ"), iRenew = idx("renewal_date", "renew"), iNotice = idx("notice"), iType = idx("renewal_type", "type"), iVal = idx("annual");
  if (iVendor < 0 || iRenew < 0) return null;
  return sheet.rows
    .map((r) => {
      const renewalDate = new Date(r[iRenew]);
      const noticeDays = iNotice >= 0 ? toNum(r[iNotice]) : 0;
      const autoRenew = iType >= 0 ? /auto/i.test(String(r[iType])) : true;
      const catId = iCat >= 0 ? String(r[iCat]) : "—";
      return { vendor: r[iVendor], catId, category: catId, renewalDate, noticeDays, autoRenew,
        annualValue: iVal >= 0 ? toNum(r[iVal]) : 0, status: KD.contractStatus({ renewalDate, noticeDays, autoRenew }) };
    })
    .filter((x) => x.vendor && !isNaN(x.renewalDate.getTime()));
}

function statusRows() {
  const wb = readWorkbookRows();
  if (wb && wb.length) return { source: "register", rows: wb };
  const rows = KD.contracts.map((c) => ({
    vendor: c.vendor, catId: c.category, category: KD.CATEGORIES[c.category]?.label || c.category,
    renewalDate: c.renewalDate, noticeDays: c.noticeDays, autoRenew: c.autoRenew,
    annualValue: c.annualValue, status: KD.contractStatus(c),
  }));
  return { source: "data", rows };
}

// ── grouping helpers ──
function groupByCat(rows, getCatId) {
  const map = new Map();
  for (const r of rows) { const k = getCatId(r); if (!map.has(k)) map.set(k, []); map.get(k).push(r); }
  const out = [];
  for (const cat of Object.values(KD.CATEGORIES)) if (map.has(cat.id)) { out.push({ id: cat.id, label: cat.label, color: cat.color, rows: map.get(cat.id) }); map.delete(cat.id); }
  for (const [k, rows2] of map) out.push({ id: k, label: KD.CATEGORIES[k]?.label || k, color: KD.CATEGORIES[k]?.color || "var(--text-muted)", rows: rows2 });
  return out;
}
function CatHeader({ label, color, count }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 8px" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0 }} /><span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{label}</span><span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{count}</span></div>;
}
// Render flat, or grouped by category, using a row-renderer that takes an array.
function Lens({ rows, grouped, getCatId, render }) {
  if (!grouped) return render(rows);
  return <div>{groupByCat(rows, getCatId).map((g) => <div key={g.id}><CatHeader label={g.label} color={g.color} count={g.rows.length} />{render(g.rows)}</div>)}</div>;
}

// ── shared bits ──
function Field({ label, value }) {
  return <div><div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>{label}</div><div style={{ fontSize: 12.5, color: "var(--text-primary)", marginTop: 2 }}>{value}</div></div>;
}
function ReviewDetail({ item, onOpenChat }) {
  const c = KD.contracts.find((x) => x.id === item.id);
  if (!c) return <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-muted)" }}>No matching contract detail.</div>;
  const st = KD.contractStatus(c);
  return (
    <div style={{ marginTop: 8, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Field label="Type" value={c.type} />
        <div><div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Status</div><div style={{ marginTop: 3 }}><K_Badge status={st.status}>{st.label}</K_Badge></div></div>
        <Field label="Renews" value={KD.fmtDate(c.renewalDate)} />
        <Field label="Notice deadline" value={KD.fmtDate(KD.noticeDeadline(c))} />
        <Field label="Notice period" value={`${c.noticeDays} days`} />
        <Field label="Annual value" value={KD.fmtMoney(c.annualValue)} />
      </div>
      <div>{c.notes}</div>
      {item.sourceChat ? (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 4 }}>Added from</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}>{item.sourceChat.title}</span>
            {onOpenChat && <button onClick={() => onOpenChat(item.sourceChat.id)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11.5, padding: 0 }}>Open conversation →</button>}
          </div>
          {item.answerExcerpt && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6, fontStyle: "italic" }}>“{item.answerExcerpt}…”</div>}
        </div>
      ) : (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-muted)" }}>Auto-flagged from this contract’s deadline.</div>
      )}
      {item.question && <div style={{ marginTop: 10, fontStyle: "italic" }}>Ask the agent: “{item.question}”</div>}
    </div>
  );
}
function Empty({ children }) {
  return <div style={{ maxWidth: 460, margin: "48px auto", textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>{children}</div>;
}

// ── Workbook status ──
const GRID = "1.7fr 1.1fr 1fr 1fr 1.2fr 0.8fr";
function StatusTable({ rows }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-2)" }}>
      <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 600, background: "var(--surface)" }}>
        <span>Vendor</span><span>Category</span><span>Renews</span><span>Notice by</span><span>Status</span><span style={{ textAlign: "right" }}>Annual</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "9px 16px", borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", fontSize: 12.5 }}>
          <span style={{ color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.vendor}</span>
          <span style={{ color: "var(--text-secondary)", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{KD.CATEGORIES[r.catId]?.label || r.category}</span>
          <span style={{ color: "var(--text-secondary)" }}>{KD.fmtDate(r.renewalDate)}</span>
          <span style={{ color: "var(--text-secondary)" }}>{KD.fmtDate(KD.noticeDeadline({ renewalDate: r.renewalDate, noticeDays: r.noticeDays }))}</span>
          <span><K_Badge status={r.status.status}>{r.status.label}</K_Badge></span>
          <span style={{ color: "var(--text-secondary)", fontFamily: "var(--mono)", fontSize: 11.5, textAlign: "right" }}>{KD.fmtMoney(r.annualValue)}</span>
        </div>
      ))}
    </div>
  );
}
function StatusView({ grouped }) {
  const { source, rows } = statusRows();
  const sorted = [...rows].sort((a, b) => a.status.days - b.status.days);
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
        {source === "register" ? "Status derived from the agent’s generated register (Workbooks → Refresh to update)."
          : "No agent workbook pulled yet — status computed from the contract data. Pull it in the Workbooks tab."}
      </div>
      <Lens rows={sorted} grouped={grouped} getCatId={(r) => r.catId} render={(rs) => <StatusTable rows={rs} />} />
    </div>
  );
}

// ── Documents ──
const KIND_TONE = { MD: { c: "var(--accent)", t: "MD" }, PDF: { c: "var(--urgent)", t: "PDF" }, DOCX: { c: "var(--ok)", t: "DOC" }, TXT: { c: "var(--text-secondary)", t: "TXT" } };
function FileGlyph({ ext }) {
  const k = KIND_TONE[ext] || KIND_TONE.MD;
  return <span style={{ width: 30, height: 30, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, fontFamily: "var(--mono)", color: k.c, background: "color-mix(in srgb, " + k.c + " 12%, transparent)", border: "1px solid color-mix(in srgb, " + k.c + " 30%, transparent)" }}>{k.t}</span>;
}
const DOC_GRID = "1.9fr 1.3fr 1fr 0.9fr 74px";
function DocTable({ rows, onOpen }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-2)" }}>
      <div style={{ display: "grid", gridTemplateColumns: DOC_GRID, gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 600, background: "var(--surface)" }}>
        <span>File</span><span>Vendor</span><span>Category</span><span>Type</span><span></span>
      </div>
      {rows.map((c, i) => {
        const ext = (c.file.split(".").pop() || "").toUpperCase();
        return (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: DOC_GRID, gap: 12, padding: "9px 16px", borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", fontSize: 12.5 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><FileGlyph ext={ext} /><span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.file}</span></span>
            <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.vendor}</span>
            <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{KD.CATEGORIES[c.category]?.label || c.category}</span>
            <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{c.type}</span>
            <button onClick={() => onOpen(c.file)} style={{ justifySelf: "end", fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", padding: "3px 10px", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>Open</button>
          </div>
        );
      })}
    </div>
  );
}

// minimal markdown renderer for the document viewer (no dep)
function mdInline(s) {
  return String(s).split(/(\*\*[^*]+\*\*)/g).map((p, i) => /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>);
}
function renderMarkdown(text) {
  const out = []; let list = null; let key = 0;
  const flush = () => { if (list) { out.push(<ul key={"u" + key++} style={{ margin: "6px 0 6px 18px", padding: 0 }}>{list}</ul>); list = null; } };
  for (const ln of String(text).replace(/\r/g, "").split("\n")) {
    const t = ln.trim();
    if (/^#{1,6}\s/.test(t)) { flush(); const lvl = t.match(/^#+/)[0].length; const sz = lvl <= 1 ? 17 : lvl === 2 ? 15 : 13.5; out.push(<div key={key++} style={{ fontSize: sz, fontWeight: 700, color: "var(--text-primary)", margin: "14px 0 6px" }}>{mdInline(t.replace(/^#+\s/, ""))}</div>); }
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out.push(<hr key={key++} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />); }
    else if (/^[-*]\s/.test(t)) { if (!list) list = []; list.push(<li key={key++} style={{ margin: "2px 0" }}>{mdInline(t.replace(/^[-*]\s/, ""))}</li>); }
    else if (t === "") { flush(); }
    else { flush(); out.push(<p key={key++} style={{ margin: "6px 0", lineHeight: 1.6 }}>{mdInline(t)}</p>); }
  }
  flush();
  return out;
}
function DocViewerModal({ doc, onClose }) {
  if (!doc) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(8,10,16,0.6)", display: "grid", placeItems: "center", zIndex: 60, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 760, maxWidth: "100%", maxHeight: "86vh", display: "flex", flexDirection: "column", background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", boxShadow: "var(--glow-accent)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <FileGlyph ext={(doc.file.split(".").pop() || "").toUpperCase()} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--mono)" }}>{doc.file}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto", fontSize: 13, color: "var(--text-secondary)" }}>
          {doc.loading ? <div style={{ color: "var(--text-muted)" }}>Fetching the document from the knowledge base…</div> : renderMarkdown(doc.content)}
        </div>
        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>source: knowledge base · markdown</div>
      </div>
    </div>
  );
}
function DocumentsView({ grouped }) {
  const [doc, setDoc] = kUseState(null);
  const open = async (file) => {
    setDoc({ file, content: "", loading: true });
    const r = await fetchDocument(file);
    setDoc({ file, content: r.content || "(No content returned — start the API server, or try again.)", loading: false });
  };
  const rows = [...KD.contracts].sort((a, b) => a.file.localeCompare(b.file));
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>The source documents in the knowledge base — one file per contract, exactly as the agent retrieves and cites them. Open one to read it.</div>
      <Lens rows={rows} grouped={grouped} getCatId={(c) => c.category} render={(rs) => <DocTable rows={rs} onOpen={open} />} />
      <DocViewerModal doc={doc} onClose={() => setDoc(null)} />
    </div>
  );
}

// ── My to-do list ──
function TodoView({ review, grouped, onOpenChat }) {
  const [open, setOpen] = kUseState(() => new Set());
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  if (!review.items.length) return <Empty>Your to-do list is clear. Add actions from the Assistant’s recommendations, then manage them here.</Empty>;
  const card = (it) => {
    const tone = it.priority === "urgent" ? "var(--urgent)" : it.priority === "warn" ? "var(--warn)" : "var(--text-muted)";
    const isOpen = open.has(it.id);
    return (
      <div key={it.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: `3px solid ${tone}`, borderRadius: "var(--radius)", padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => toggle(it.id)} title="Details" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--mono)" }}>{isOpen ? "▾" : "▸"}</button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.vendor}</span>
          <K_Badge status={it.priority === "urgent" ? "urgent" : it.priority === "warn" ? "warn" : "muted"}>{it.label}</K_Badge>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <K_Countdown to={it.deadline} compact />
            <button onClick={() => review.removeItem(it.id)} title="Remove from queue" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--urgent)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>✕</button>
          </span>
        </div>
        {isOpen && <ReviewDetail item={it} onOpenChat={onOpenChat} />}
      </div>
    );
  };
  return <Lens rows={review.items} grouped={grouped} getCatId={(i) => i.category} render={(rs) => <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{rs.map(card)}</div>} />;
}

// ── Combined (status ↔ to-do) ──
function CombinedView({ review, grouped, onOpenChat }) {
  const [open, setOpen] = kUseState(() => new Set());
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todoOf = (id) => review.items.find((i) => i.id === id);
  const rows = [...KD.contracts].sort((a, b) => KD.contractStatus(a).days - KD.contractStatus(b).days);
  const card = (c) => {
    const st = KD.contractStatus(c); const todo = todoOf(c.id); const isOpen = open.has(c.id);
    return (
      <div key={c.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => toggle(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--mono)" }}>{isOpen ? "▾" : "▸"}</button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.vendor}</span>
          <K_Badge status={st.status}>{st.label}</K_Badge>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {todo ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--accent)" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />on to-do · {KD.fmtDate(todo.deadline)}</span> : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>}
            <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "var(--mono)" }}>{KD.fmtMoney(c.annualValue)}</span>
          </span>
        </div>
        {isOpen && <ReviewDetail item={todo || { id: c.id, question: `What are the exact cancellation and renewal terms for the ${c.vendor} contract, and what is the deadline to act?` }} onOpenChat={onOpenChat} />}
      </div>
    );
  };
  return <Lens rows={rows} grouped={grouped} getCatId={(c) => c.category} render={(rs) => <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{rs.map(card)}</div>} />;
}

const VIEWS = [["status", "Workbook status"], ["todo", "My to-do list"], ["combined", "Combined"], ["documents", "Documents"]];

function KnowledgeBaseTab({ review = { items: [], removeItem: () => {} }, onOpenChat }) {
  const [view, setView] = kUseState("status");
  const [grouped, setGrouped] = kUseState(false);
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "var(--surface)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 26px 60px" }}>
        {/* Corpus summary */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 16px", marginBottom: 18 }}>
          <span style={{ width: 30, height: 30, borderRadius: 6, background: "rgba(0,120,212,0.12)", border: "1px solid rgba(0,120,212,0.3)", display: "grid", placeItems: "center", color: "var(--accent)", fontSize: 14, flexShrink: 0 }}>⬚</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Contract corpus</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Cross-reference the agent’s workbook with your review queue.</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ok)", boxShadow: "var(--glow-ok)" }} />{KD.contracts.length} documents indexed</div>
        </div>

        {/* View toggle + grouping toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", padding: 3 }}>
            {VIEWS.map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} style={{ border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)", padding: "6px 16px", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font)", transition: "all var(--dur-fast)", background: view === id ? "var(--accent)" : "transparent", color: view === id ? "#fff" : "var(--text-secondary)" }}>{label}</button>
            ))}
          </div>
          <div style={{ display: "inline-flex", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", padding: 3 }} title="View flat, or grouped by category">
            {[[false, "Flat"], [true, "Grouped"]].map(([val, label]) => (
              <button key={label} onClick={() => setGrouped(val)} style={{ border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)", padding: "6px 14px", fontSize: 12, fontWeight: 600, fontFamily: "var(--font)", transition: "all var(--dur-fast)", background: grouped === val ? "var(--surface-4)" : "transparent", color: grouped === val ? "var(--text-primary)" : "var(--text-muted)" }}>{label}</button>
            ))}
          </div>
        </div>

        {view === "status" && <StatusView grouped={grouped} />}
        {view === "todo" && <TodoView review={review} grouped={grouped} onOpenChat={onOpenChat} />}
        {view === "combined" && <CombinedView review={review} grouped={grouped} onOpenChat={onOpenChat} />}
        {view === "documents" && <DocumentsView grouped={grouped} />}
      </div>
    </div>
  );
}

export { KnowledgeBaseTab, ReviewDetail };
