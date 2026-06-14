// ───────── Knowledge Base tab — SharePoint: Current vs Organized ─────────
import { Badge as K_Badge, Chip as K_Chip, SectionLabel as K_SectionLabel } from "./ui.jsx";
import * as KD from "./data.js";
import React, { useState as kUseState } from "react";

// The corpus as a flat document library — one file per contract (the real set).
function libraryRows() {
  const rows = [];
  KD.contracts.forEach((c) => {
    rows.push({ name: c.file.replace(/\.md$/, ".pdf"), kind: "PDF", vendor: c.vendor, by: "Procurement", when: "Mar–May 2026", cat: c.category, size: (180 + (c.annualValue % 400)) + " KB" });
  });
  return rows;
}

const KIND_TONE = { PDF: { c: "var(--urgent)", t: "PDF" }, XLSX: { c: "var(--ok)", t: "XLS" }, DOCX: { c: "var(--accent)", t: "DOC" }, FOLDER: { c: "var(--warn)", t: "DIR" } };

function FileGlyph({ kind }) {
  const k = KIND_TONE[kind] || KIND_TONE.PDF;
  return <span style={{ width: 30, height: 30, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, fontFamily: "var(--mono)", color: k.c, background: "color-mix(in srgb, " + k.c + " 12%, transparent)", border: "1px solid color-mix(in srgb, " + k.c + " 30%, transparent)" }}>{k.t}</span>;
}

function CurrentForm() {
  const rows = libraryRows();
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-2)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 150px 90px", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 600, background: "var(--surface)" }}>
        <span>Name</span><span>Modified by</span><span>Modified</span><span style={{ textAlign: "right" }}>Size</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 150px 90px", gap: 12, padding: "9px 16px", borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", fontSize: 12.5 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><FileGlyph kind={r.kind} /><span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span></span>
          <span style={{ color: "var(--text-secondary)", fontSize: 11.5 }}>{r.by}</span>
          <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{r.when}</span>
          <span style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "right", fontFamily: "var(--mono)" }}>{r.size || "—"}</span>
        </div>
      ))}
    </div>
  );
}

function OrganizedForm() {
  const cats = Object.values(KD.CATEGORIES);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, alignItems: "start" }}>
      {cats.map((cat) => {
        const members = KD.contracts.filter((c) => c.category === cat.id);
        const total = members.reduce((s, c) => s + c.annualValue, 0);
        return (
          <div key={cat.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: cat.color }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{cat.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{members.length} · {KD.fmtMoney(total)}</span>
            </div>
            {members.map((c) => {
              const st = KD.contractStatus(c);
              return (
                <div key={c.id} draggable style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 10px", cursor: "grab" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                  <span style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1, cursor: "grab" }}>⠿</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.vendor}</span>
                    <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>{c.type}</span>
                  </span>
                  <K_Badge status={st.status}>{st.label}</K_Badge>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function KnowledgeBaseTab() {
  const [view, setView] = kUseState("organized");
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 26px 40px" }}>
        {/* Corpus summary — the documents grounding the agent's knowledge base */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 16px", marginBottom: 18 }}>
          <span style={{ width: 30, height: 30, borderRadius: 6, background: "rgba(0,120,212,0.12)", border: "1px solid rgba(0,120,212,0.3)", display: "grid", placeItems: "center", color: "var(--accent)", fontSize: 14, flexShrink: 0 }}>⬚</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Contract corpus</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>The source documents the agent grounds every answer in.</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ok)", boxShadow: "var(--glow-ok)" }} />{KD.contracts.length} documents indexed</div>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ display: "inline-flex", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", padding: 3 }}>
            {[["current", "Current form"], ["organized", "Organized form"]].map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} style={{ border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)", padding: "6px 16px", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font)", transition: "all var(--dur-fast)", background: view === id ? "var(--accent)" : "transparent", color: view === id ? "#fff" : "var(--text-secondary)" }}>{label}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{view === "current" ? "The raw document library — one file per contract." : "The same files re-clustered by idea — drag to explore (non-persistent)."}</div>
        </div>

        {view === "current" ? <CurrentForm /> : <OrganizedForm />}
      </div>
    </div>
  );
}

export { KnowledgeBaseTab };
