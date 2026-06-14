// Shared UI primitives for the Contoso Contract Intelligence kit.
// These mirror the published design-system components (window.Contoso.Button,
// .Badge, .Citation, …) but are inlined here so the kit renders standalone.
// In production, swap these for the bundled primitives.
import React, { useState, useEffect, useRef } from "react";

// ───────── Logo ─────────
function Logo({ size = 30, withWordmark = false, title = "Contoso Contract Intelligence", subtitle = "Compliance & contract intelligence · grounded on the contract corpus" }) {
  const mark = (
    <div style={{ width: size, height: size, borderRadius: size <= 32 ? 8 : 10, background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", display: "grid", placeItems: "center", color: "#fff", fontSize: Math.round(size * 0.53), boxShadow: "0 0 16px var(--accent-glow)", flexShrink: 0 }}>◈</div>
  );
  if (!withWordmark) return mark;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {mark}
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{subtitle}</div>
      </div>
    </div>
  );
}

// ───────── Badge ─────────
function Badge({ status = "muted", children, style }) {
  const palette = {
    urgent: { background: "var(--urgent-bg)", color: "var(--urgent)" },
    warn: { background: "var(--warn-bg)", color: "var(--warn)" },
    ok: { background: "var(--ok-bg)", color: "var(--ok)" },
    muted: { background: "var(--surface-4)", color: "var(--text-secondary)" },
  };
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: "var(--radius-pill)", whiteSpace: "nowrap", display: "inline-block", ...palette[status], ...style }}>{children}</span>;
}

// ───────── Chip ─────────
function Chip({ children, onClick, size = "md", active = false, style }) {
  const [hover, setHover] = useState(false);
  const sm = size === "sm";
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ fontFamily: "var(--font)", fontSize: sm ? 10 : 12, fontWeight: sm ? 600 : 400, padding: sm ? "1px 7px" : "7px 13px", borderRadius: "var(--radius-pill)", cursor: "pointer", whiteSpace: "nowrap",
        background: active ? "var(--accent-glow)" : sm ? "var(--surface-4)" : hover ? "var(--surface-4)" : "var(--surface-3)",
        border: `1px solid ${active ? "var(--accent)" : hover && !sm ? "var(--accent)" : "var(--border)"}`,
        color: active ? "var(--text-primary)" : hover && !sm ? "var(--text-primary)" : "var(--text-secondary)",
        transition: "all var(--dur-fast)", ...style }}>{children}</button>
  );
}

// ───────── Button ─────────
function Button({ children, variant = "primary", size = "md", iconOnly = false, disabled = false, onClick, style, ...rest }) {
  const [hover, setHover] = useState(false);
  const base = { fontFamily: "var(--font)", fontSize: size === "sm" ? 12 : 13.5, fontWeight: 600, borderRadius: "var(--radius)", border: "1px solid transparent", cursor: disabled ? "not-allowed" : "pointer", transition: "all var(--dur-fast)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, lineHeight: 1 };
  const variants = {
    primary: { background: disabled ? "var(--surface-4)" : hover ? "var(--accent-hover)" : "var(--accent)", color: disabled ? "var(--text-muted)" : "#fff" },
    ghost: { background: hover && !disabled ? "var(--surface-4)" : "transparent", color: disabled ? "var(--text-muted)" : "var(--text-secondary)", borderColor: hover && !disabled ? "var(--border-strong)" : "var(--border)" },
    accentText: { background: "none", color: disabled ? "var(--text-muted)" : "var(--accent)", padding: 0, textDecoration: hover && !disabled ? "underline" : "none" },
  };
  const sizing = iconOnly ? { width: size === "sm" ? 30 : 36, height: size === "sm" ? 30 : 36, padding: 0, fontSize: 16, flexShrink: 0 } : { padding: variant === "accentText" ? 0 : size === "sm" ? "6px 12px" : "9px 16px" };
  return <button disabled={disabled} onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ ...base, ...variants[variant], ...sizing, ...style }} {...rest}>{children}</button>;
}

// ───────── StatCard ─────────
function StatCard({ value, label, accent = "default", style }) {
  const numColor = { default: "var(--text-primary)", urgent: "var(--urgent)", warn: "var(--warn)", ok: "var(--ok)" }[accent];
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", ...style }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: numColor, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ───────── SectionLabel ─────────
function SectionLabel({ children, count, countTone = "urgent", style }) {
  const tone = { urgent: { background: "var(--urgent-bg)", color: "var(--urgent)" }, warn: { background: "var(--warn-bg)", color: "var(--warn)" }, accent: { background: "var(--accent-glow)", color: "var(--accent)" } }[countTone];
  return (
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8, ...style }}>
      {children}
      {count != null && <span style={{ borderRadius: "var(--radius-pill)", padding: "1px 8px", fontSize: 10, letterSpacing: 0, ...tone }}>{count}</span>}
    </div>
  );
}

// ───────── Citation ─────────
function Citation({ children, style }) {
  return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, background: "var(--ok-bg)", color: "var(--ok)", border: "1px solid var(--ok-border)", borderRadius: "var(--radius-sm)", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 5, ...style }}><span aria-hidden="true" style={{ fontSize: 10 }}>📄</span>{children}</span>;
}

// ───────── PlanStep ─────────
function PlanStep({ index = 0, children, animate = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--mono)", animation: animate ? "ds-slideIn .28s ease both" : "none", animationDelay: animate ? `${index * 0.12}s` : "0s" }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, background: "var(--accent-glow)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700 }}>{index + 1}</span>
      <span>{children}</span>
    </div>
  );
}

// ───────── ConnectionStatus ─────────
function ConnectionStatus({ status = "demo", label, style }) {
  const dot = { live: { background: "var(--ok)", boxShadow: "var(--glow-ok)" }, demo: { background: "var(--text-muted)" }, fail: { background: "var(--urgent)", boxShadow: "var(--glow-urgent)" } }[status];
  const text = label || (status === "live" ? "Foundry IQ connected" : status === "fail" ? "Connection failed" : "Demo mode");
  return <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)", ...style }}><span style={{ width: 8, height: 8, borderRadius: "50%", ...dot }} />{text}</div>;
}

// ───────── Countdown — live ticking timer to a deadline ─────────
function Countdown({ to, compact = false }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = new Date(to).getTime() - now;
  const past = ms < 0;
  const abs = Math.abs(ms);
  const dd = Math.floor(abs / 86400000);
  const hh = Math.floor((abs % 86400000) / 3600000);
  const mm = Math.floor((abs % 3600000) / 60000);
  const ss = Math.floor((abs % 60000) / 1000);
  const tone = past ? "var(--urgent)" : dd <= 14 ? "var(--urgent)" : dd <= 45 ? "var(--warn)" : "var(--ok)";
  const seg = (n, u) => <span style={{ fontFamily: "var(--mono)" }}>{String(n).padStart(2, "0")}<span style={{ color: "var(--text-muted)", fontSize: "0.8em" }}>{u}</span></span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, color: tone, fontSize: compact ? 12 : 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
      {past && <span style={{ fontSize: "0.8em" }}>−</span>}
      {dd > 0 && seg(dd, "d")} {seg(hh, "h")} {seg(mm, "m")} {!compact && seg(ss, "s")}
    </span>
  );
}

export { Logo, Badge, Chip, Button, StatCard, SectionLabel, Citation, PlanStep, ConnectionStatus, Countdown };
