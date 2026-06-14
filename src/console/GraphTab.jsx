// ───────── Graph tab — contracts as a relationship graph (drag · pan · zoom) ─────────
// Clustered by domain (the source of truth), then linked by what contracts SHARE so
// you can see correlations: redundancy, DPA, renewal timing, price escalation.
import { Badge, Chip, Countdown, Citation } from "./ui.jsx";
import * as GD from "./data.js";
import React, { useState as gUseState, useMemo as gUseMemo, useRef as gUseRef } from "react";

const W = 1000, H = 720, CX = W / 2, CY = H / 2;
const STATUS_RING = { urgent: "var(--urgent)", warn: "var(--warn)", ok: "var(--ok)", muted: "var(--text-muted)" };
const REL = [
  { key: "redundancy", label: "Same function", color: "#B58BE0", hint: "Overlapping / redundant tools in the same area" },
  { key: "dpa", label: "Data privacy (DPA)", color: "var(--ok)", hint: "Both bound by a Data Processing Agreement — they handle personal data" },
  { key: "timing", label: "Renewal timing", color: "var(--warn)", hint: "Notice deadlines within 30 days — act on them together" },
  { key: "escalation", label: "Same increase rate", color: "var(--urgent)", hint: "Their renewal price rises by the same % each year" },
];
const relColor = (k) => REL.find((r) => r.key === k).color;

// Radial seed layout: Contoso → category → contracts. Returns nodes + spine edges + positions.
function buildLayout() {
  const cats = Object.values(GD.CATEGORIES);
  const nodes = [{ id: "root", kind: "root", label: "Contoso", r: 46, color: "var(--accent)" }];
  const pos = { root: { x: CX, y: CY } };
  const spine = [];
  const catR = 250;
  cats.forEach((cat, ci) => {
    const a = (ci / cats.length) * Math.PI * 2 - Math.PI / 2;
    const cx = CX + Math.cos(a) * catR, cy = CY + Math.sin(a) * catR;
    nodes.push({ id: "cat-" + cat.id, kind: "cat", label: cat.label, r: 30, color: cat.color, cat: cat.id });
    pos["cat-" + cat.id] = { x: cx, y: cy };
    spine.push({ from: "root", to: "cat-" + cat.id, color: cat.color });
    const members = GD.contracts.filter((c) => c.category === cat.id);
    const spread = Math.min(Math.PI * 0.95, members.length * 0.4);
    members.forEach((c, mi) => {
      const ma = a + (members.length > 1 ? (mi / (members.length - 1) - 0.5) * spread : 0);
      const mr = 132 + (mi % 2) * 30;
      const st = GD.contractStatus(c);
      nodes.push({ id: c.id, kind: "contract", label: c.vendor, r: 16 + Math.min(20, Math.sqrt(c.annualValue) / 28), color: cat.color, cat: cat.id, contract: c, status: st });
      pos[c.id] = { x: cx + Math.cos(ma) * mr, y: cy + Math.sin(ma) * mr };
      spine.push({ from: "cat-" + cat.id, to: c.id, color: cat.color });
    });
  });
  return { nodes, spine, pos };
}

// Contract↔contract relationship edges — each is a REAL correlation with a stated
// reason (not "both mention X"). Computed from the data, scales to any corpus.
function buildRelEdges() {
  const cs = GD.contracts;
  const dl = (c) => GD.noticeDeadline(c).getTime();
  const edges = [];
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j];
    if (a.category === b.category)
      edges.push({ a: a.id, b: b.id, type: "redundancy", reason: `Both are ${GD.CATEGORIES[a.category].label} — overlapping function` });
    if (a.dataPrivacy && b.dataPrivacy)
      edges.push({ a: a.id, b: b.id, type: "dpa", reason: "Both carry a Data Processing Agreement (handle personal data)" });
    const days = Math.round(Math.abs(dl(a) - dl(b)) / 86400000);
    if (days <= 30)
      edges.push({ a: a.id, b: b.id, type: "timing", reason: `Notice deadlines ${days} day${days === 1 ? "" : "s"} apart` });
    // Escalation only correlates contracts whose renewal increase is the SAME rate —
    // i.e. their prices move together — not merely "both have a price clause".
    if (a.escalationPct && b.escalationPct && a.escalationPct === b.escalationPct)
      edges.push({ a: a.id, b: b.id, type: "escalation", reason: `Both renew at +${a.escalationPct}% a year` });
  }
  return edges;
}

function ZoomBtn({ onClick, title, children }) {
  return <button onClick={onClick} title={title} style={{ width: 28, height: 28, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, display: "grid", placeItems: "center" }}
    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border)"; }}>{children}</button>;
}

function GraphTab() {
  const { nodes, spine } = gUseMemo(buildLayout, []);
  const relEdges = gUseMemo(buildRelEdges, []);
  const byId = gUseMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const [pos, setPos] = gUseState(() => buildLayout().pos);
  const [view, setView] = gUseState({ tx: 40, ty: 10, scale: 0.82 });
  const [sel, setSel] = gUseState(null);
  const [hover, setHover] = gUseState(null);
  const [enabled, setEnabled] = gUseState({ redundancy: true, dpa: false, timing: false, escalation: false });
  const drag = gUseRef(null);
  const moved = gUseRef(false);
  const wrapRef = gUseRef(null);

  const edges = [
    ...spine.map((e) => ({ from: e.from, to: e.to, color: e.color, rel: false })),
    ...relEdges.filter((e) => enabled[e.type]).map((e) => ({ from: e.a, to: e.b, color: relColor(e.type), rel: true })),
  ];
  const active = sel || hover;
  const connected = new Set();
  if (active) { connected.add(active); edges.forEach((e) => { if (e.from === active || e.to === active) { connected.add(e.from); connected.add(e.to); } }); }

  const onMove = (e) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
    if (dx || dy) moved.current = true;
    if (d.type === "pan") setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    else setView((v) => { setPos((p) => ({ ...p, [d.id]: { x: p[d.id].x + dx / v.scale, y: p[d.id].y + dy / v.scale } })); return v; });
  };
  const onUp = () => { drag.current = null; };
  const onWheel = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setView((v) => { const scale = Math.min(2.5, Math.max(0.3, v.scale * (e.deltaY < 0 ? 1.1 : 0.9))); return { scale, tx: mx - ((mx - v.tx) / v.scale) * scale, ty: my - ((my - v.ty) / v.scale) * scale }; });
  };
  const zoomBy = (f) => setView((v) => { const scale = Math.min(2.5, Math.max(0.3, v.scale * f)); return { scale, tx: CX - ((CX - v.tx) / v.scale) * scale, ty: CY - ((CY - v.ty) / v.scale) * scale }; });
  const reset = () => { setPos(buildLayout().pos); setView({ tx: 40, ty: 10, scale: 0.82 }); };
  const toggle = (k) => setEnabled((s) => ({ ...s, [k]: !s[k] }));

  const selNode = sel ? byId[sel] : null;
  const relatedOf = (id) => REL.map((r) => ({ ...r, items: relEdges.filter((e) => e.type === r.key && (e.a === id || e.b === id)).map((e) => ({ vendor: byId[e.a === id ? e.b : e.a]?.label, reason: e.reason })).filter((x) => x.vendor) })).filter((r) => r.items.length);

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--surface)" }}>
      <div ref={wrapRef} onWheel={onWheel}
        onPointerDown={(e) => { drag.current = { type: "pan", x: e.clientX, y: e.clientY }; moved.current = false; }}
        onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        onClick={() => { if (!moved.current) setSel(null); }}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: "grab", touchAction: "none", userSelect: "none" }}>
        <div style={{ position: "absolute", top: 18, left: 22, zIndex: 5, pointerEvents: "none", maxWidth: 320 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 600 }}>Contract relationship graph</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>Clustered by domain, linked by what contracts share. Drag a node, scroll to zoom, drag the canvas to pan. Toggle relationships at right; click a contract to isolate it.</div>
        </div>
        <div style={{ position: "absolute", top: 18, right: 18, zIndex: 5, display: "flex", gap: 6 }}>
          <ZoomBtn title="Zoom in" onClick={() => zoomBy(1.15)}>+</ZoomBtn>
          <ZoomBtn title="Zoom out" onClick={() => zoomBy(0.87)}>−</ZoomBtn>
          <button title="Reset the view (re-center and un-zoom)" onClick={reset} style={{ height: 28, padding: "0 11px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border)"; }}>⤾ Reset</button>
        </div>

        <div style={{ position: "absolute", inset: 0, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`, transformOrigin: "0 0" }}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
            {edges.map((e, i) => {
              const A = pos[e.from], B = pos[e.to]; if (!A || !B) return null;
              const on = !active || (connected.has(e.from) && connected.has(e.to));
              return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={e.color}
                strokeWidth={e.rel ? (on ? 2 : 1) : (e.from === "root" ? 1.8 : 1.1)}
                strokeOpacity={on ? (e.rel ? 0.65 : 0.4) : 0.05} strokeDasharray={e.rel ? "5 4" : "none"} style={{ transition: "stroke-opacity .2s" }} />;
            })}
          </svg>
          {nodes.map((n) => {
            const p = pos[n.id]; if (!p) return null;
            const on = !active || connected.has(n.id);
            const ring = n.kind === "contract" ? STATUS_RING[n.status.status] : n.color;
            return (
              <div key={n.id}
                onPointerDown={(e) => { e.stopPropagation(); drag.current = { type: "node", id: n.id, x: e.clientX, y: e.clientY }; moved.current = false; }}
                onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                onClick={(e) => { e.stopPropagation(); if (!moved.current) setSel(sel === n.id ? null : n.id); }}
                style={{ position: "absolute", left: p.x - n.r, top: p.y - n.r, width: n.r * 2, height: n.r * 2, borderRadius: "50%", cursor: "grab",
                  display: "grid", placeItems: "center", textAlign: "center", transition: "opacity .2s, box-shadow .2s",
                  opacity: on ? 1 : 0.16,
                  background: n.kind === "root" ? "linear-gradient(135deg, var(--accent), var(--accent-hover))" : n.kind === "cat" ? "color-mix(in srgb, " + n.color + " 22%, var(--surface-3))" : "var(--surface-3)",
                  border: `${n.kind === "contract" ? 2 : 1.5}px solid ${ring}`,
                  boxShadow: n.kind === "root" ? "0 0 24px var(--accent-glow)" : (sel === n.id || hover === n.id) ? `0 0 16px color-mix(in srgb, ${ring} 50%, transparent)` : "none" }}>
                {n.kind !== "contract" && <span style={{ fontSize: n.kind === "root" ? 13 : 10, fontWeight: 700, color: n.kind === "root" ? "#fff" : "var(--text-primary)", padding: 4, lineHeight: 1.15, pointerEvents: "none" }}>{n.label}</span>}
                {n.kind === "contract" && (sel === n.id || hover === n.id) && <span style={{ position: "absolute", top: "100%", marginTop: 4, whiteSpace: "nowrap", fontSize: 10.5, fontWeight: 600, color: "var(--text-primary)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", pointerEvents: "none" }}>{n.label}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: relationship toggles + legend, or selected-contract detail */}
      <aside style={{ width: 300, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--surface-2)", overflowY: "auto", padding: 18 }}>
        {!selNode && (
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 10 }}>Relationships</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REL.map((r) => (
                <button key={r.key} onClick={() => toggle(r.key)} style={{ display: "flex", alignItems: "center", gap: 9, background: enabled[r.key] ? "var(--surface-3)" : "transparent", border: `1px solid ${enabled[r.key] ? "var(--border-strong)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "8px 10px", cursor: "pointer", textAlign: "left", fontFamily: "var(--font)" }}>
                  <span style={{ width: 18, height: 0, borderTop: `2px dashed ${r.color}`, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: enabled[r.key] ? "var(--text-primary)" : "var(--text-secondary)" }}>{r.label}</span>
                    <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>{r.hint}</span>
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: enabled[r.key] ? "var(--ok)" : "var(--text-muted)" }}>{enabled[r.key] ? "ON" : "OFF"}</span>
                </button>
              ))}
            </div>
            <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }} />
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 10 }}>Domains</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.values(GD.CATEGORIES).map((c) => <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--text-secondary)" }}><span style={{ width: 11, height: 11, borderRadius: "50%", background: c.color, flexShrink: 0 }} />{c.label}</div>)}
            </div>
            <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }} />
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 10 }}>Renewal ring</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[["urgent", "Action needed now"], ["warn", "Notice window open"], ["ok", "Auto-renew, clear"], ["muted", "Manual renewal"]].map(([k, l]) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--text-secondary)" }}><span style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${STATUS_RING[k]}`, flexShrink: 0 }} />{l}</div>)}
            </div>
          </div>
        )}
        {selNode && selNode.kind === "contract" && (() => { const c = selNode.contract; const st = selNode.status; const rels = relatedOf(c.id); return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: selNode.color }} /><span style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{GD.CATEGORIES[c.category].label}</span></div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{c.vendor}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{c.type}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge status={st.status}>{st.label}</Badge>
              {c.autoRenew && <Chip size="sm">auto-renew</Chip>}
              {c.dataPrivacy && <Chip size="sm">DPA</Chip>}
              {c.priceEscalation && <Chip size="sm">{c.escalationPct ? `+${c.escalationPct}%` : "escalation"}</Chip>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Renews</div><div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>{GD.fmtDate(c.renewalDate)}</div></div>
              <div><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notice</div><div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>{c.noticeDays} days</div></div>
              <div><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Annual value</div><div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>{GD.fmtMoney(c.annualValue)}</div></div>
              <div><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Time to act</div><div style={{ marginTop: 2 }}><Countdown to={c.autoRenew ? GD.noticeDeadline(c) : c.renewalDate} compact /></div></div>
            </div>
            {rels.length > 0 && (
              <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>Related contracts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rels.map((r) => (
                    <div key={r.key} style={{ fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${r.color}` }} /><span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{r.label}</span></div>
                      <div style={{ paddingLeft: 21, display: "flex", flexDirection: "column", gap: 5 }}>
                        {r.items.map((it, i) => (
                          <div key={i}>
                            <span style={{ color: "var(--text-primary)" }}>{it.vendor}</span>
                            <span style={{ display: "block", color: "var(--text-muted)", fontSize: 11 }}>{it.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, paddingTop: 12, borderTop: "1px solid var(--border)" }}>{c.notes}</div>
            <Citation>{c.file}</Citation>
          </div>
        ); })()}
        {selNode && selNode.kind !== "contract" && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{selNode.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{selNode.kind === "root" ? "All vendor contracts under management." : "Domain cluster — click a contract bubble for detail."}</div>
          </div>
        )}
      </aside>
    </div>
  );
}

export { GraphTab };
