// ───────── App shell — header, tabs, settings, and all shared stores ─────────
import { Logo as S_Logo, ConnectionStatus as S_Conn } from "./ui.jsx";
import { AssistantTab as S_Assistant } from "./AssistantTab.jsx";
import { KnowledgeBaseTab as S_KB } from "./KnowledgeBaseTab.jsx";
import { GraphTab as S_Graph } from "./GraphTab.jsx";
import { WorkbookTab as S_Workbook } from "./WorkbookTab.jsx";
import { SettingsPage as S_Settings } from "./SettingsPage.jsx";
import { demoAnswer as S_demoAnswer, recosFromCitations, citationsFromAnswer } from "./chat.jsx";
import * as SDATA from "./data.js";
import { askContract, checkConnection } from "../lib/foundry.js";
import React, { useState as sUseState, useEffect as sUseEffect, useRef as sUseRef } from "react";

const TABS = [
  { id: "assistant", label: "Assistant" },
  { id: "knowledge", label: "Knowledge base" },
  { id: "graph", label: "Web graph" },
  { id: "workbooks", label: "Workbooks" },
];

const LS = { settings: "cci-settings", convos: "cci-conversations", active: "cci-active" };
const readLS = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// ───────── Settings store ─────────
const SETTINGS_DEFAULTS = { theme: "dark", cb: false, alertMode: "manual", lead: 45, workflow: "kanban" };
function useSettings() {
  const [s, setS] = sUseState(() => ({ ...SETTINGS_DEFAULTS, ...readLS(LS.settings, {}) }));
  sUseEffect(() => {
    writeLS(LS.settings, s);
    document.documentElement.setAttribute("data-theme", s.theme);
    if (s.cb) document.documentElement.setAttribute("data-cb", "on");
    else document.documentElement.removeAttribute("data-cb");
  }, [s]);
  return { ...s, set: (patch) => setS((p) => ({ ...p, ...patch })) };
}

// ───────── Review queue store ─────────
function useReview() {
  const [items, setItems] = sUseState(() => SDATA.buildReviewItems());
  const [addedId, setAddedId] = sUseState(null);
  const [filedIds, setFiledIds] = sUseState(() => new Set());
  const hasItem = (id) => items.some((i) => i.id === id);
  const addItems = (recos, ctx = {}) => {
    const ids = new Set(items.map((i) => i.id));
    const toAdd = recos.filter((r) => !ids.has(r.id));
    if (!toAdd.length) return;
    const built = toAdd.map((r) => SDATA.reviewItemFromContract(r.id, { label: r.label, priority: r.priority, source: "agent", sourceChat: ctx.sourceChat, answerExcerpt: ctx.answerExcerpt })).filter(Boolean);
    setItems([...items, ...built].sort((a, b) => a.days - b.days));
    setAddedId(built[built.length - 1].id);
    setTimeout(() => setAddedId(null), 2200);
  };
  const fileNotice = (id) => setFiledIds((prev) => new Set(prev).add(id));
  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  return { items, addItems, hasItem, addedId, filedIds, fileNotice, removeItem };
}

// ───────── Memory store ─────────
const MEMORY_DEFAULTS = [
  { id: "m1", text: "Fiscal year ends June 30", kind: "fact" },
  { id: "m2", text: "Legal must approve any contract over $100k", kind: "policy" },
  { id: "m3", text: "Renewal owner is the Procurement team", kind: "fact" },
  { id: "m4", text: "Flag any vendor handling PHI or employee SSNs", kind: "policy" },
];
function useMemory() {
  // OFF by default: with memory on we prepend facts to every question, which
  // changes the agent's answers. Keep parity with a bare prompt unless the user
  // opts in. (New LS key so any previously-persisted "on" doesn't carry over.)
  const [enabled, setEnabled] = sUseState(() => readLS("cci-mem-enabled", false) === true);
  const [facts, setFacts] = sUseState(() => readLS("cci-memory", MEMORY_DEFAULTS));
  sUseEffect(() => writeLS("cci-memory", facts), [facts]);
  sUseEffect(() => writeLS("cci-mem-enabled", enabled), [enabled]);
  const add = (text) => { const t = (text || "").trim(); if (!t) return; setFacts((f) => [...f, { id: "m" + Date.now(), text: t, kind: "fact" }]); };
  const forget = (id) => setFacts((f) => f.filter((x) => x.id !== id));
  return { enabled, setEnabled, facts, add, forget };
}

// ───────── Conversations + chat store ─────────
function useChats() {
  const idRef = sUseRef(Date.now());
  const nid = (p) => p + ++idRef.current;
  const [convos, setConvos] = sUseState(() => {
    const stored = readLS(LS.convos, null);
    if (stored && stored.length) return stored;
    return [{ id: "c0", title: "New chat", messages: [], createdAt: Date.now() }];
  });
  const [activeId, setActiveId] = sUseState(() => readLS(LS.active, null) || "c0");
  const [loading, setLoading] = sUseState(false);
  const [activePlan, setActivePlan] = sUseState([]);

  sUseEffect(() => { if (!convos.find((c) => c.id === activeId)) setActiveId(convos[0]?.id || null); }, []);
  sUseEffect(() => { writeLS(LS.convos, convos); if (activeId) writeLS(LS.active, activeId); }, [convos, activeId]);

  const active = convos.find((c) => c.id === activeId) || convos[0];
  const messages = active?.messages || [];

  const addMsg = (cid, msg) => setConvos((cs) => cs.map((c) => {
    if (c.id !== cid) return c;
    const next = [...c.messages, msg];
    let title = c.title;
    if (msg.role === "user" && (!c.title || c.title === "New chat")) title = msg.text.slice(0, 44);
    return { ...c, messages: next, title };
  }));

  const sendMessage = async (text, opts) => {
    if (!text || !text.trim() || loading) return;
    const q = text.trim(), cid = activeId;
    const memory = (opts && opts.memory) || [];
    addMsg(cid, { id: nid("m"), role: "user", text: q });
    setLoading(true); setActivePlan([]);

    // Ask the real Foundry agent. askContract never throws — it returns
    // { live:false } and degrades to the kit's canned demo engine when the
    // local proxy isn't reachable, so the UI keeps working offline.
    const res = await askContract(q, { memory });
    let answer, citations, queryPlan, recos, live;
    if (res.live) {
      answer = res.answer; queryPlan = res.queryPlan || [];
      // Prefer the agent's retrieval-derived citations; if it computed the answer
      // (no retrieval), map vendors named in the answer to their source files.
      citations = (res.citations && res.citations.length) ? res.citations : citationsFromAnswer(answer);
      recos = recosFromCitations(citations); live = true;
    } else {
      const d = S_demoAnswer(q, memory);
      answer = d.answer; citations = d.citations; queryPlan = d.queryPlan; recos = d.recos || []; live = false;
    }

    // Stream the reasoning-trace steps into the topbar one-by-one.
    for (let i = 0; i < queryPlan.length; i++) {
      setActivePlan(queryPlan.slice(0, i + 1));
      await new Promise((r) => setTimeout(r, 360));
    }
    addMsg(cid, { id: nid("m"), role: "assistant", text: answer, citations, queryPlan, recos: recos || [], live });
    setLoading(false); setActivePlan([]);
  };

  const addUserMessage = (text) => addMsg(activeId, { id: nid("m"), role: "user", text });
  const addAssistantMessage = (obj) => addMsg(activeId, { id: nid("m"), role: "assistant", citations: [], queryPlan: [], recos: [], ...obj });

  const newChat = () => { const id = nid("c"); setConvos((cs) => [{ id, title: "New chat", messages: [], createdAt: Date.now() }, ...cs]); setActiveId(id); };
  const selectChat = (id) => setActiveId(id);
  const renameChat = (id, title) => setConvos((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c)));
  const deleteChat = (id) => setConvos((cs) => {
    const next = cs.filter((c) => c.id !== id);
    if (next.length === 0) { const nc = { id: nid("c"), title: "New chat", messages: [], createdAt: Date.now() }; setActiveId(nc.id); return [nc]; }
    if (id === activeId) setActiveId(next[0].id);
    return next;
  });

  return { convos, activeId, messages, loading, activePlan, sendMessage, addUserMessage, addAssistantMessage, newChat, selectChat, renameChat, deleteChat };
}

function TopTabs({ tab, setTab }) {
  return (
    <nav style={{ display: "flex", gap: 2, alignSelf: "stretch", alignItems: "stretch" }}>
      {TABS.map((t) => {
        const on = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ position: "relative", border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 13, fontWeight: 600, color: on ? "var(--text-primary)" : "var(--text-secondary)", padding: "0 14px", display: "flex", alignItems: "center", transition: "color var(--dur-fast)" }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = "var(--text-primary)"; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = "var(--text-secondary)"; }}>
            {t.label}
            <span style={{ position: "absolute", left: 12, right: 12, bottom: 0, height: 2, borderRadius: 2, background: on ? "var(--accent)" : "transparent", boxShadow: on ? "0 0 8px var(--accent-glow)" : "none" }} />
          </button>
        );
      })}
    </nav>
  );
}

function App() {
  const [tab, setTab] = sUseState("assistant");
  const [input, setInput] = sUseState("");
  const settings = useSettings();
  const review = useReview();
  const memory = useMemory();
  const chat = useChats();
  const autoProcessed = sUseRef(new Set());

  // Live/demo badge — reflects whether the local Foundry proxy is answering.
  const [conn, setConn] = sUseState({ status: "demo", label: "Demo mode" });
  sUseEffect(() => {
    checkConnection().then((c) => setConn({ status: c.status, label: c.status === "live" ? "Foundry agent connected" : "Demo mode" }));
  }, []);

  // Provenance helpers — remember which chat/answer produced a queued action.
  const activeTitle = () => chat.convos.find((c) => c.id === chat.activeId)?.title || "Chat";
  const ctxFrom = (msg) => ({ sourceChat: { id: chat.activeId, title: activeTitle() }, answerExcerpt: (msg?.text || "").slice(0, 220) });
  const openChat = (id) => { if (id) chat.selectChat(id); setTab("assistant"); };

  // Auto-pilot: when on, urgent recommendations are added to the queue automatically.
  sUseEffect(() => {
    if (settings.alertMode !== "auto") return;
    const last = [...chat.messages].reverse().find((m) => m.role === "assistant" && m.recos && m.recos.length);
    if (!last || autoProcessed.current.has(last.id)) return;
    autoProcessed.current.add(last.id);
    const urgent = last.recos.filter((r) => r.priority === "urgent");
    if (urgent.length) review.addItems(urgent, ctxFrom(last));
  }, [chat.messages, settings.alertMode]);

  const onSend = (raw) => {
    const q = (raw || "").trim();
    if (!q) return;
    if (tab !== "assistant") setTab("assistant");
    setInput("");
    // "add that to my to-do list" intent — pull recos from the last cited answer.
    const addIntent = /\badd (that|these|those|them|it)\b/i.test(q) || /\b(add|put)\b[\s\S]*\b(to-?do|todo|review|list|dashboard|queue|board)\b/i.test(q);
    if (addIntent) {
      const lastA = [...chat.messages].reverse().find((m) => m.role === "assistant" && m.recos && m.recos.length);
      chat.addUserMessage(q);
      if (lastA) {
        review.addItems(lastA.recos, ctxFrom(lastA));
        chat.addAssistantMessage({ text: `Done — added ${lastA.recos.length} action${lastA.recos.length > 1 ? "s" : ""} to your review queue. They're on your board now with live countdowns.` });
      } else {
        chat.addAssistantMessage({ text: `Ask me about your contracts first — then say “add that to my to-do list” and I'll drop the recommended actions straight onto your board.` });
      }
      return;
    }
    chat.sendMessage(q, { memory: memory.enabled ? memory.facts.map((f) => f.text) : [] });
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "stretch", gap: 0, padding: "0 20px", height: 56, background: "var(--surface-2)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 24 }}><S_Logo withWordmark /></div>
        <TopTabs tab={tab} setTab={setTab} />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 20, padding: "5px 12px", background: "var(--surface-3)" }}>Powered by <b style={{ color: "var(--text-primary)", fontWeight: 600 }}>Foundry IQ</b></span>
          <S_Conn status={conn.status} label={conn.label} />
          <button onClick={() => setTab("settings")} title="Settings" style={{ background: tab === "settings" ? "var(--surface-4)" : "none", border: "1px solid", borderColor: tab === "settings" ? "var(--border-strong)" : "transparent", borderRadius: "var(--radius)", cursor: "pointer", color: tab === "settings" ? "var(--text-primary)" : "var(--text-secondary)", fontSize: 16, width: 32, height: 32, display: "grid", placeItems: "center", transition: "all var(--dur-fast)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")} onMouseLeave={(e) => { if (tab !== "settings") e.currentTarget.style.color = "var(--text-secondary)"; }}>⚙</button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {tab === "assistant" && <S_Assistant conversations={chat} chat={chat} input={input} setInput={setInput} onSend={onSend} review={review} settings={settings} memory={memory} onOpenSettings={() => setTab("settings")} />}
        {tab === "knowledge" && <S_KB review={review} onOpenChat={openChat} />}
        {tab === "graph" && <S_Graph />}
        {tab === "workbooks" && <S_Workbook />}
        {tab === "settings" && <S_Settings settings={settings} memory={memory} />}
      </div>
    </div>
  );
}

export { App };
