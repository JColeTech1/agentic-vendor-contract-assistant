// ───────── Workbooks tab — one Excel workbook, sheet tabs at the bottom ─────────
import * as XD from "./data.js";
import React, { useState as xUseState } from "react";
const XLS_GREEN = "#217346", XLS_GREEN_LT = "#33a06f";

// Recommended sheets, built live from the contract corpus.
function recommendedSheets() {
  const cs = XD.contracts;
  const catLabel = (id) => XD.CATEGORIES[id].label;
  return [
    {
      id: "renewals", name: "Renewals", desc: "Live renewal clock — what the agent watches",
      cols: ["Vendor", "Renews", "Notice Deadline", "Days Left", "Status", "Owner"],
      rows: cs.map((c) => { const st = XD.contractStatus(c); const dl = c.autoRenew ? XD.noticeDeadline(c) : c.renewalDate; return [c.vendor, XD.fmtDate(c.renewalDate), XD.fmtDate(dl), String(XD.daysUntil(dl)), st.label, "Procurement"]; }),
      statusCol: 4, changed: { "0-3": 1, "1-3": 1, "2-4": 1 },
    },
    {
      id: "contracts", name: "All Contracts", desc: "Master register — one row per active contract",
      cols: ["Vendor", "Category", "Type", "Annual Value", "Auto-Renew", "Renews", "Notice (d)"],
      rows: cs.map((c) => [c.vendor, catLabel(c.category), c.type, XD.fmtMoney(c.annualValue), c.autoRenew ? "Yes" : "No", XD.fmtDate(c.renewalDate), String(c.noticeDays)]),
      changed: { "0-3": 1, "2-5": 1 },
    },
    {
      id: "escalations", name: "Escalations", desc: "Price-escalation exposure across renewals",
      cols: ["Vendor", "Escalation", "Cap %", "Annual Value", "Est. +1yr Impact"],
      rows: cs.filter((c) => c.priceEscalation).map((c) => [c.vendor, c.escalationPct ? "Fixed cap" : "CPI / usage", c.escalationPct ? c.escalationPct + "%" : "CPI", XD.fmtMoney(c.annualValue), c.escalationPct ? XD.fmtMoney(Math.round(c.annualValue * c.escalationPct / 100)) : "≈ CPI"]),
      changed: { "0-2": 1 },
    },
    {
      id: "dpa", name: "DPA Register", desc: "Data-privacy obligations & breach windows",
      cols: ["Vendor", "DPA", "Breach Notice", "Special Data", "Renews"],
      rows: cs.filter((c) => c.dataPrivacy).map((c) => [c.vendor, "Signed", c.id === "securehaven" ? "24h" : "72h", c.id === "keystone" ? "PHI (HIPAA BAA)" : c.id === "ledgerwise" ? "SSN / bank" : "Personal data", XD.fmtDate(c.renewalDate)]),
      changed: {},
    },
  ];
}

function colLetter(i) { return String.fromCharCode(65 + i); }
const isNum = (v) => /^[\$]?[\d.,%+-]+$/.test(String(v).trim()) && /\d/.test(String(v));

function Sheet({ sheet, editable, onEditCell }) {
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
      <thead>
        <tr>
          <th style={{ position: "sticky", top: 0, zIndex: 2, width: 40, background: "var(--surface)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}></th>
          {sheet.cols.map((_, i) => <th key={i} style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--surface)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 500, padding: "3px 0" }}>{colLetter(i)}</th>)}
        </tr>
        <tr>
          <th style={{ position: "sticky", top: 22, zIndex: 2, width: 40, background: "var(--surface)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 500 }}>1</th>
          {sheet.cols.map((c, i) => <th key={i} style={{ position: "sticky", top: 22, zIndex: 2, textAlign: "left", background: "color-mix(in srgb, " + XLS_GREEN + " 16%, var(--surface-3))", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border-strong)", color: "var(--text-primary)", fontWeight: 600, padding: "8px 12px", whiteSpace: "nowrap" }}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((row, ri) => (
          <tr key={ri}>
            <td style={{ width: 40, textAlign: "center", background: "var(--surface)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 10 }}>{ri + 2}</td>
            {row.map((cell, ci) => {
              const isChanged = sheet.changed && sheet.changed[`${ri}-${ci}`];
              let color = ci === 0 ? "var(--text-primary)" : "var(--text-secondary)";
              if (sheet.statusCol === ci) { const v = String(cell).toLowerCase(); color = v.includes("passed") || v.includes("act") ? "var(--urgent)" : v.includes("window") || v.includes("expires") ? "var(--warn)" : v.includes("auto") ? "var(--ok)" : "var(--text-secondary)"; }
              return (
                <td key={ci} contentEditable={editable} suppressContentEditableWarning
                  onBlur={editable ? (e) => onEditCell(ri, ci, e.currentTarget.textContent) : undefined}
                  style={{ borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "7px 12px", whiteSpace: "nowrap", color, fontWeight: ci === 0 ? 600 : 400, fontFamily: isNum(cell) ? "var(--mono)" : "var(--font)", background: isChanged ? "rgba(45,189,126,0.12)" : "transparent", boxShadow: isChanged ? "inset 0 0 0 1px var(--ok-border)" : "none", outline: "none", minWidth: 80, cursor: editable ? "text" : "default" }}>{cell}</td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SheetTab({ name, active, custom, onClick, onRename }) {
  const [editing, setEditing] = xUseState(false);
  const [draft, setDraft] = xUseState(name);
  if (editing) {
    return <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { onRename(draft.trim() || name); setEditing(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onRename(draft.trim() || name); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      style={{ width: 110, background: "var(--surface-2)", border: "1px solid var(--accent)", borderRadius: "6px 6px 0 0", color: "var(--text-primary)", fontFamily: "var(--font)", fontSize: 12, fontWeight: 600, padding: "7px 10px", outline: "none" }} />;
  }
  return (
    <button onClick={onClick} onDoubleClick={() => custom && (setDraft(name), setEditing(true))} title={custom ? "Double-click to rename" : ""}
      style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderBottom: active ? "none" : "1px solid var(--border)", borderTop: active ? `2px solid ${XLS_GREEN_LT}` : "1px solid var(--border)", borderRadius: "7px 7px 0 0", padding: "6px 14px", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
        background: active ? "var(--surface-2)" : "var(--surface)", color: active ? "var(--text-primary)" : "var(--text-secondary)", marginBottom: active ? -1 : 0, transition: "all var(--dur-fast)" }}>
      {custom ? <span style={{ color: "var(--accent)", fontSize: 10 }}>✎</span> : <span style={{ color: XLS_GREEN_LT, fontSize: 9, fontWeight: 700, fontFamily: "var(--mono)" }}>▦</span>}
      {name}
    </button>
  );
}

function WorkbookTab() {
  const recs = recommendedSheets();
  const [custom, setCustom] = xUseState([]);
  const [activeId, setActiveId] = xUseState(recs[0].id);
  const all = [...recs, ...custom];
  const sheet = all.find((s) => s.id === activeId) || recs[0];
  const isCustom = sheet.id.startsWith("custom-");

  const addTable = () => {
    const n = custom.length + 1;
    const s = { id: "custom-" + Date.now(), name: "My table " + n, custom: true, cols: ["Vendor", "Owner", "Status", "Notes"], rows: Array.from({ length: 4 }, () => ["", "", "", ""]) };
    setCustom((c) => [...c, s]);
    setActiveId(s.id);
  };
  const editCell = (ri, ci, val) => setCustom((cs) => cs.map((s) => s.id === activeId ? { ...s, rows: s.rows.map((r, i) => i === ri ? r.map((c, j) => (j === ci ? val : c)) : r) } : s));
  const addRow = () => setCustom((cs) => cs.map((s) => s.id === activeId ? { ...s, rows: [...s.rows, s.cols.map(() => "")] } : s));
  const renameSheet = (name) => setCustom((cs) => cs.map((s) => s.id === activeId ? { ...s, name } : s));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--surface)" }}>
      {/* Workbook header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 26px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 6, background: "color-mix(in srgb, " + XLS_GREEN + " 16%, transparent)", border: "1px solid color-mix(in srgb, " + XLS_GREEN + " 40%, transparent)", display: "grid", placeItems: "center", color: XLS_GREEN_LT, fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)", flexShrink: 0 }}>XLS</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Contracts.xlsx</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>contoso.sharepoint.com / sites / Legal / Contracts / _Workbooks</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-secondary)", maxWidth: 340, textAlign: "right", lineHeight: 1.45 }}>{isCustom ? "Your own table — type into any cell. Lives in the same workbook." : sheet.desc + " · cells in green changed since the agent's last sync."}</div>
      </div>

      {/* Active sheet */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 0 0 0", background: "var(--surface-2)" }}>
        <Sheet sheet={sheet} editable={isCustom} onEditCell={editCell} />
        {isCustom && (
          <button onClick={addRow} style={{ margin: 12, background: "var(--surface-3)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)", color: "var(--text-secondary)", fontFamily: "var(--font)", fontSize: 12, fontWeight: 600, padding: "7px 14px", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>＋ Add row</button>
        )}
      </div>

      {/* Sheet tab bar (Excel-style) */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, padding: "0 16px", borderTop: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, height: 40, overflowX: "auto" }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 600, alignSelf: "center", marginRight: 6, flexShrink: 0 }}>Recommended</span>
        {recs.map((s) => <SheetTab key={s.id} name={s.name} active={s.id === activeId} onClick={() => setActiveId(s.id)} />)}
        {custom.length > 0 && <span style={{ width: 1, height: 22, background: "var(--border)", margin: "0 6px", alignSelf: "center", flexShrink: 0 }} />}
        {custom.map((s) => <SheetTab key={s.id} name={s.name} active={s.id === activeId} custom onClick={() => setActiveId(s.id)} onRename={renameSheet} />)}
        <button onClick={addTable} title="New custom table" style={{ alignSelf: "center", marginLeft: 4, width: 28, height: 28, flexShrink: 0, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)", fontSize: 16, cursor: "pointer", display: "grid", placeItems: "center" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>＋</button>
      </div>
    </div>
  );
}

export { WorkbookTab };
