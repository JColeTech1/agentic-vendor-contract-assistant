// ───────── Settings page — consolidates appearance & workflow prefs ─────────
const SET_WORKFLOWS = [
  { id: "list", label: "List", hint: "Flat priority queue" },
  { id: "kanban", label: "Kanban", hint: "Grouped by urgency lane" },
  { id: "agile", label: "Sprint", hint: "This sprint vs backlog" },
  { id: "timeline", label: "Timeline", hint: "Chronological by deadline" },
];

function SettingRow({ title, desc, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", padding: 3 }}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{ border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)", padding: "6px 16px", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font)", transition: "all var(--dur-fast)", background: value === o.id ? "var(--accent)" : "transparent", color: value === o.id ? "#fff" : "var(--text-secondary)" }}>{o.label}</button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 40, height: 22, borderRadius: 20, border: "none", cursor: "pointer", background: on ? "var(--accent)" : "var(--surface-4)", position: "relative", flexShrink: 0, transition: "background var(--dur-fast)" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left var(--dur-fast)" }} />
    </button>
  );
}

function SettingsCard({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "4px 18px" }}>{children}</div>
    </div>
  );
}

import React, { useState as setUseState } from "react";

function MemorySection({ memory }) {
  const [draft, setDraft] = setUseState("");
  const submit = () => { memory.add(draft); setDraft(""); };
  return (
    <SettingsCard label="Memory">
      <SettingRow title="Remember facts across chats" desc="The agent applies these to every answer — without re-sending them each time.">
        <Toggle on={memory.enabled} onChange={(v) => memory.setEnabled(v)} />
      </SettingRow>
      <div style={{ padding: "14px 0", opacity: memory.enabled ? 1 : 0.5, pointerEvents: memory.enabled ? "auto" : "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {memory.facts.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No remembered facts yet. Add one below, or tell the agent in chat.</div>}
          {memory.facts.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "9px 12px" }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: f.kind === "policy" ? "var(--warn)" : "var(--accent)", background: f.kind === "policy" ? "var(--warn-bg)" : "var(--accent-glow)", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>{f.kind}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-primary)" }}>{f.text}</span>
              <button onClick={() => memory.forget(f.id)} title="Forget" style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--urgent)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>Forget ✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Add a fact the agent should remember…"
            style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--text-primary)", fontFamily: "var(--font)", fontSize: 13, padding: "9px 12px", outline: "none" }} />
          <button onClick={submit} disabled={!draft.trim()} style={{ flexShrink: 0, background: draft.trim() ? "var(--accent)" : "var(--surface-4)", color: draft.trim() ? "#fff" : "var(--text-muted)", border: "none", borderRadius: "var(--radius)", fontFamily: "var(--font)", fontSize: 13, fontWeight: 600, padding: "0 16px", cursor: draft.trim() ? "pointer" : "not-allowed" }}>Remember</button>
        </div>
      </div>
    </SettingsCard>
  );
}

function SettingsPage({ settings, memory }) {
  const s = settings;
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--surface)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 26px 60px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)", marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 26 }}>Appearance and workflow preferences. These follow you across every workspace.</p>

        <SettingsCard label="Appearance">
          <SettingRow title="Theme" desc="Dark is default. Light is a clean, cool white — no cream.">
            <Segmented options={[{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }]} value={s.theme} onChange={(v) => s.set({ theme: v })} />
          </SettingRow>
          <SettingRow title="Colour-blind-safe palette" desc="Swaps the red / amber / green triage ramp for magenta / orange / teal.">
            <Toggle on={s.cb} onChange={(v) => s.set({ cb: v })} />
          </SettingRow>
        </SettingsCard>

        <SettingsCard label="Review workflow">
          <div style={{ padding: "14px 0" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>How your review board is organised</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Pick the method your team thinks in. The Review queue on the Assistant re-groups instantly.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {SET_WORKFLOWS.map((w) => {
                const on = s.workflow === w.id;
                return (
                  <button key={w.id} onClick={() => s.set({ workflow: w.id })} style={{ textAlign: "left", cursor: "pointer", background: on ? "var(--surface-3)" : "var(--surface)", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "11px 13px", fontFamily: "var(--font)", boxShadow: on ? "var(--ring-accent)" : "none", transition: "all var(--dur-fast)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, display: "grid", placeItems: "center", flexShrink: 0 }}>{on && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{w.label}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 5, paddingLeft: 22 }}>{w.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard label="Alerts">
          <SettingRow title="Recommended actions" desc={
            s.alertMode === "auto" ? "Automatic: the agent adds urgent actions to your queue and drafts notices — you still approve before anything is filed."
            : s.alertMode === "never" ? "Never: the agent won't suggest actions. Answers only."
            : "Manual: the agent suggests actions; you approve or deny each one. Nothing is added without you."}>
            <Segmented options={[{ id: "auto", label: "Automatic" }, { id: "manual", label: "Manual" }, { id: "never", label: "Never" }]} value={s.alertMode} onChange={(v) => s.set({ alertMode: v })} />
          </SettingRow>
          <SettingRow title="Warn me before a deadline" desc="How far ahead a renewal starts surfacing in your review queue.">
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 200 }}>
              <input type="range" min="15" max="90" step="15" value={s.lead} onChange={(e) => s.set({ lead: +e.target.value })} style={{ flex: 1, accentColor: "var(--accent)" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", width: 38, textAlign: "right" }}>{s.lead}d</span>
            </div>
          </SettingRow>
        </SettingsCard>
      </div>
    </div>
  );
}

export { SettingsPage };
