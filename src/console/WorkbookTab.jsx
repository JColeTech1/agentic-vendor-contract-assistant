// ───────── Workbooks tab — the agent's real generated files + human tables ─────────
// "From the agent": files the agent actually wrote (downloaded via /api/workbook).
// "Yours": tables humans create inline, or spreadsheets they upload (.csv / .xlsx).
import React, { useState as xUseState, useEffect as xUseEffect, useRef as xUseRef } from "react";
import * as XLSX from "xlsx";
import { fetchAgentWorkbook } from "../lib/foundry.js";

const XLS_GREEN = "#217346", XLS_GREEN_LT = "#33a06f";
const LS_AGENT = "cci-wb-agent", LS_HUMAN = "cci-wb-human";
const readLS = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch { return fb; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ── parsers ──
function parseCSV(text) {
  const s = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  return clean.length ? { cols: clean[0], rows: clean.slice(1) } : { cols: [], rows: [] };
}
function parseXLSX(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
  if (!aoa.length) return { cols: [], rows: [] };
  return { cols: aoa[0].map((c) => (c == null ? "" : String(c))), rows: aoa.slice(1).map((r) => r.map((c) => (c == null ? "" : String(c)))) };
}

const isNum = (v) => /^[\$]?[\d.,%+-]+$/.test(String(v).trim()) && /\d/.test(String(v));
const colLetter = (i) => String.fromCharCode(65 + (i % 26));

// ── the grid ──
function Sheet({ sheet, editable, onEditCell }) {
  const cols = sheet.cols || [], rows = sheet.rows || [];
  if (!cols.length) return <div style={{ padding: 28, color: "var(--text-muted)", fontSize: 13 }}>This sheet is empty.</div>;
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
      <thead>
        <tr>
          <th style={{ position: "sticky", top: 0, zIndex: 2, width: 40, background: "var(--surface)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}></th>
          {cols.map((_, i) => <th key={i} style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--surface)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 500, padding: "3px 0" }}>{colLetter(i)}</th>)}
        </tr>
        <tr>
          <th style={{ position: "sticky", top: 22, zIndex: 2, width: 40, background: "var(--surface)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 500 }}>1</th>
          {cols.map((c, i) => <th key={i} style={{ position: "sticky", top: 22, zIndex: 2, textAlign: "left", background: "color-mix(in srgb, " + XLS_GREEN + " 16%, var(--surface-3))", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border-strong)", color: "var(--text-primary)", fontWeight: 600, padding: "8px 12px", whiteSpace: "nowrap" }}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            <td style={{ width: 40, textAlign: "center", background: "var(--surface)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 10 }}>{ri + 2}</td>
            {cols.map((_, ci) => {
              const cell = r[ci] == null ? "" : r[ci];
              return (
                <td key={ci} contentEditable={editable} suppressContentEditableWarning
                  onBlur={editable ? (e) => onEditCell(ri, ci, e.currentTarget.textContent) : undefined}
                  style={{ borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "7px 12px", whiteSpace: "nowrap", color: ci === 0 ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: ci === 0 ? 600 : 400, fontFamily: isNum(cell) ? "var(--mono)" : "var(--font)", outline: "none", minWidth: 80, cursor: editable ? "text" : "default" }}>{cell}</td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SheetTab({ name, active, custom, onClick, onRename, glyph, glyphColor }) {
  const [editing, setEditing] = xUseState(false);
  const [draft, setDraft] = xUseState(name);
  if (editing) {
    return <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { onRename(draft.trim() || name); setEditing(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onRename(draft.trim() || name); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      style={{ width: 120, background: "var(--surface-2)", border: "1px solid var(--accent)", borderRadius: "6px 6px 0 0", color: "var(--text-primary)", fontFamily: "var(--font)", fontSize: 12, fontWeight: 600, padding: "7px 10px", outline: "none" }} />;
  }
  return (
    <button onClick={onClick} onDoubleClick={() => custom && (setDraft(name), setEditing(true))} title={custom ? "Double-click to rename" : ""}
      style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderTop: active ? `2px solid ${XLS_GREEN_LT}` : "1px solid var(--border)", borderBottom: active ? "none" : "1px solid var(--border)", borderRadius: "7px 7px 0 0", padding: "6px 14px", cursor: "pointer", fontFamily: "var(--font)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
        background: active ? "var(--surface-2)" : "var(--surface)", color: active ? "var(--text-primary)" : "var(--text-secondary)", marginBottom: active ? -1 : 0, transition: "all var(--dur-fast)" }}>
      <span style={{ color: glyphColor, fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)" }}>{glyph}</span>
      {name}
    </button>
  );
}

function WorkbookTab() {
  const [agent, setAgent] = xUseState(() => readLS(LS_AGENT, []));   // [{id,name,cols,rows}]
  const [human, setHuman] = xUseState(() => readLS(LS_HUMAN, []));   // [{id,name,cols,rows,custom}]
  const [loading, setLoading] = xUseState(false);
  const [note, setNote] = xUseState("");
  const [activeId, setActiveId] = xUseState(null);
  const fileRef = xUseRef(null);

  xUseEffect(() => writeLS(LS_AGENT, agent), [agent]);
  xUseEffect(() => writeLS(LS_HUMAN, human), [human]);

  const refreshAgent = async () => {
    setLoading(true); setNote("");
    const res = await fetchAgentWorkbook();
    if (res.sheets && res.sheets.length) {
      const parsed = res.sheets.map((s) => ({ id: "agent-" + s.filename, name: s.filename, ...parseCSV(s.content) }));
      setAgent(parsed);
      setActiveId((cur) => cur || parsed[0]?.id);
    } else {
      setNote(res.live ? (res.note || "The agent didn't return a file this time — try Refresh.") : "Offline — showing the last synced copy. Start the API server to refresh.");
    }
    setLoading(false);
  };

  // First open: if nothing is cached, pull once; otherwise show cache (refresh is manual).
  xUseEffect(() => { if (!agent.length) refreshAgent(); /* eslint-disable-next-line */ }, []);

  const all = [...agent, ...human];
  const active = all.find((s) => s.id === activeId) || all[0];
  const isHuman = active && human.some((h) => h.id === active.id);

  const addTable = () => {
    const n = human.filter((h) => h.custom).length + 1;
    const s = { id: "custom-" + Date.now(), name: "My table " + n, custom: true, cols: ["Vendor", "Owner", "Status", "Notes"], rows: Array.from({ length: 4 }, () => ["", "", "", ""]) };
    setHuman((h) => [...h, s]); setActiveId(s.id);
  };
  const onUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const parsed = /\.xlsx?$/i.test(file.name) ? parseXLSX(await file.arrayBuffer()) : parseCSV(await file.text());
      if (!parsed.cols.length) setNote(`Couldn't read any rows from ${file.name}.`);
      else {
        const s = { id: "upload-" + Date.now(), name: file.name, custom: true, ...parsed };
        setHuman((h) => [...h, s]); setActiveId(s.id); setNote("");
      }
    } catch (err) { setNote(`Upload failed: ${err.message}`); }
    e.target.value = "";
  };
  const editCell = (ri, ci, val) => setHuman((hs) => hs.map((s) => s.id === active.id ? { ...s, rows: s.rows.map((r, i) => i === ri ? r.map((c, j) => (j === ci ? val : c)) : r) } : s));
  const addRow = () => setHuman((hs) => hs.map((s) => s.id === active.id ? { ...s, rows: [...s.rows, s.cols.map(() => "")] } : s));
  const renameSheet = (name) => setHuman((hs) => hs.map((s) => s.id === active.id ? { ...s, name } : s));
  const deleteActive = () => { const id = active.id; setHuman((hs) => hs.filter((s) => s.id !== id)); setActiveId(null); };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--surface)" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 26px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 6, background: "color-mix(in srgb, " + XLS_GREEN + " 16%, transparent)", border: "1px solid color-mix(in srgb, " + XLS_GREEN + " 40%, transparent)", display: "grid", placeItems: "center", color: XLS_GREEN_LT, fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)", flexShrink: 0 }}>XLS</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Workbooks</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{active ? (isHuman ? "Your table — type into any cell." : `${active.name} · generated by the agent`) : "No sheets yet."}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={refreshAgent} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: loading ? "var(--text-muted)" : "var(--text-primary)", fontFamily: "var(--font)", fontSize: 12, fontWeight: 600, padding: "7px 12px", cursor: loading ? "default" : "pointer" }}>
            {loading ? "Refreshing…" : "↻ Refresh from agent"}
          </button>
        </div>
      </div>

      {note && <div style={{ padding: "8px 26px", fontSize: 11.5, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{note}</div>}

      {/* active sheet */}
      <div style={{ flex: 1, overflow: "auto", background: "var(--surface-2)" }}>
        {!all.length ? (
          <div style={{ maxWidth: 440, margin: "60px auto", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>{loading ? "Pulling the agent's workbook…" : "No workbooks yet"}</div>
            <div style={{ fontSize: 12.5 }}>Pull the agent's contract register with “↻ Refresh from agent”, or add your own table / upload a spreadsheet below.</div>
          </div>
        ) : (
          <>
            <Sheet sheet={active} editable={isHuman} onEditCell={editCell} />
            {isHuman && (
              <div style={{ display: "flex", gap: 8, padding: 12 }}>
                <button onClick={addRow} style={{ background: "var(--surface-3)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)", color: "var(--text-secondary)", fontFamily: "var(--font)", fontSize: 12, fontWeight: 600, padding: "7px 14px", cursor: "pointer" }}>＋ Add row</button>
                <button onClick={deleteActive} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)", fontFamily: "var(--font)", fontSize: 12, fontWeight: 600, padding: "7px 14px", cursor: "pointer" }}>Delete sheet</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* tab bar */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, padding: "0 16px", borderTop: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, height: 40, overflowX: "auto" }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 600, alignSelf: "center", marginRight: 6, flexShrink: 0 }}>From the agent</span>
        {agent.map((s) => <SheetTab key={s.id} name={s.name} active={s.id === active?.id} glyph="▦" glyphColor={XLS_GREEN_LT} onClick={() => setActiveId(s.id)} />)}
        {!agent.length && <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center", marginRight: 4 }}>(none yet)</span>}

        <span style={{ width: 1, height: 22, background: "var(--border)", margin: "0 8px", alignSelf: "center", flexShrink: 0 }} />
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 600, alignSelf: "center", marginRight: 6, flexShrink: 0 }}>Yours</span>
        {human.map((s) => <SheetTab key={s.id} name={s.name} active={s.id === active?.id} custom glyph="✎" glyphColor="var(--accent)" onClick={() => setActiveId(s.id)} onRename={renameSheet} />)}

        <button onClick={addTable} title="New table" style={{ alignSelf: "center", marginLeft: 4, width: 28, height: 28, flexShrink: 0, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)", fontSize: 16, cursor: "pointer", display: "grid", placeItems: "center" }}>＋</button>
        <button onClick={() => fileRef.current?.click()} title="Upload .csv or .xlsx" style={{ alignSelf: "center", width: 28, height: 28, flexShrink: 0, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer", display: "grid", placeItems: "center" }}>⤓</button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onUpload} style={{ display: "none" }} />
      </div>
    </div>
  );
}

export { WorkbookTab };
