import { Badge, Chip, Countdown, Citation } from "./ui.jsx";
// ───────── Graph tab — contracts & renewals as a connected bubble map ─────────
import * as GD from "./data.js";
import React, { useState as gUseState, useMemo as gUseMemo } from "react";

const W = 980, H = 680, CX = W / 2, CY = H / 2;

// Precompute a radial layout: Contoso → categories → contracts.
function buildGraph() {
  const cats = Object.values(GD.CATEGORIES);
  const nodes = [{ id: "root", kind: "root", label: "Contoso", x: CX, y: CY, r: 46, color: "var(--accent)" }];
  const edges = [];
  const catR = 230;
  cats.forEach((cat, ci) => {
    const a = (ci / cats.length) * Math.PI * 2 - Math.PI / 2;
    const cx = CX + Math.cos(a) * catR, cy = CY + Math.sin(a) * catR;
    nodes.push({ id: "cat-" + cat.id, kind: "cat", label: cat.label, x: cx, y: cy, r: 30, color: cat.color, cat: cat.id });
    edges.push({ from: "root", to: "cat-" + cat.id, color: cat.color });
    const members = GD.contracts.filter((c) => c.category === cat.id);
    const spread = Math.min(Math.PI * 0.9, members.length * 0.42);
    members.forEach((c, mi) => {
      const ma = a + (members.length > 1 ? (mi / (members.length - 1) - 0.5) * spread : 0);
      const mr = 120 + (mi % 2) * 26;
      const mx = cx + Math.cos(ma) * mr, my = cy + Math.sin(ma) * mr;
      const st = GD.contractStatus(c);
      const size = 16 + Math.min(20, Math.sqrt(c.annualValue) / 28);
      nodes.push({ id: c.id, kind: "contract", label: c.vendor, x: mx, y: my, r: size, color: cat.color, cat: cat.id, contract: c, status: st });
      edges.push({ from: "cat-" + cat.id, to: c.id, color: cat.color, status: st.status });
    });
  });
  return { nodes, edges };
}

const STATUS_RING = { urgent: "var(--urgent)", warn: "var(--warn)", ok: "var(--ok)", muted: "var(--text-muted)" };

function GraphTab() {
  const { nodes, edges } = gUseMemo(buildGraph, []);
  const [sel, setSel] = gUseState(null);
  const [hover, setHover] = gUseState(null);
  const byId = gUseMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const active = sel || hover;
  const connected = new Set();
  if (active) { edges.forEach((e) => { if (e.from === active || e.to === active) { connected.add(e.from); connected.add(e.to); } }); connected.add(active); }

  const selNode = sel ? byId[sel] : null;

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--surface)" }}>
      <div style={{ flex: 1, overflow: "auto", position: "relative", padding: 20 }}>
        <div style={{ position: "absolute", top: 22, left: 26, zIndex: 5, pointerEvents: "none" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 600 }}>Contract graph</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4, maxWidth: 320 }}>Every contract, clustered by domain and linked to its renewal obligations. Hover to trace connections; click for detail.</div>
        </div>
        <div style={{ position: "relative", width: W, height: H, margin: "0 auto" }}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            {edges.map((e, i) => {
              const a = byId[e.from], b = byId[e.to];
              const on = !active || (connected.has(e.from) && connected.has(e.to));
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.color} strokeWidth={e.from === "root" ? 1.8 : 1.2} strokeOpacity={on ? 0.5 : 0.08} style={{ transition: "stroke-opacity .2s" }} />;
            })}
          </svg>
          {nodes.map((n) => {
            const on = !active || connected.has(n.id);
            const ring = n.kind === "contract" ? STATUS_RING[n.status.status] : n.color;
            return (
              <div key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onClick={() => setSel(sel === n.id ? null : n.id)}
                style={{ position: "absolute", left: n.x - n.r, top: n.y - n.r, width: n.r * 2, height: n.r * 2, borderRadius: "50%", cursor: "pointer",
                  display: "grid", placeItems: "center", textAlign: "center", transition: "opacity .2s, box-shadow .2s, transform .15s",
                  opacity: on ? 1 : 0.22, transform: sel === n.id ? "scale(1.12)" : "scale(1)",
                  background: n.kind === "root" ? "linear-gradient(135deg, var(--accent), var(--accent-hover))" : n.kind === "cat" ? "color-mix(in srgb, " + n.color + " 22%, var(--surface-3))" : "var(--surface-3)",
                  border: `${n.kind === "contract" ? 2 : 1.5}px solid ${ring}`,
                  boxShadow: n.kind === "root" ? "0 0 24px var(--accent-glow)" : sel === n.id || hover === n.id ? `0 0 16px color-mix(in srgb, ${ring} 50%, transparent)` : "none" }}>
                {n.kind !== "contract" && <span style={{ fontSize: n.kind === "root" ? 13 : 10, fontWeight: 700, color: n.kind === "root" ? "#fff" : "var(--text-primary)", padding: 4, lineHeight: 1.15 }}>{n.label}</span>}
                {n.kind === "contract" && (sel === n.id || hover === n.id) && (
                  <span style={{ position: "absolute", top: "100%", marginTop: 4, whiteSpace: "nowrap", fontSize: 10.5, fontWeight: 600, color: "var(--text-primary)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", pointerEvents: "none" }}>{n.label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      <aside style={{ width: 300, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--surface-2)", overflowY: "auto", padding: 18 }}>
        {!selNode && (
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 12 }}>Legend</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {Object.values(GD.CATEGORIES).map((c) => <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--text-secondary)" }}><span style={{ width: 11, height: 11, borderRadius: "50%", background: c.color, flexShrink: 0 }} />{c.label}</div>)}
            </div>
            <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }} />
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 10 }}>Renewal ring</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[["urgent", "Action needed now"], ["warn", "Notice window open"], ["ok", "Auto-renew, clear"], ["muted", "Manual renewal"]].map(([k, l]) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--text-secondary)" }}><span style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${STATUS_RING[k]}`, flexShrink: 0 }} />{l}</div>)}
            </div>
          </div>
        )}
        {selNode && selNode.kind === "contract" && (() => { const c = selNode.contract; const st = selNode.status; return (
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
