# TASKS — Contoso Contract Intelligence
# Claude Code works through this list top to bottom.
# Check off each item as it is completed.
# Do not skip items. Do not move to the next section until the current one passes.

---

## PHASE 1 — Project scaffold
[ ] Run `npm create vite@latest . -- --template react` in the project folder
[ ] Install dependencies: `npm install`
[ ] Verify `npm run dev` starts without errors (blank page is fine)
[ ] Create `.gitignore` — must include `.env.local`, `node_modules/`, `dist/`
[ ] Confirm `.env.local` is NOT tracked by git (`git status` should not show it)
[ ] Create the full `src/` folder structure from CLAUDE.md
[ ] Copy design tokens into `src/index.css` exactly as specified in CLAUDE.md
[ ] Add Google Fonts link (Inter + JetBrains Mono) to `index.html`

---

## PHASE 2 — Data layer
[ ] Create `src/data/contracts.js` with all 7 synthetic contracts per CLAUDE.md spec
[ ] Export `offsetDate(days)` helper from contracts.js
[ ] Verify all 7 contracts have every required field (id, vendor, type, renewalDate, noticeDays, autoRenew, annualValue, dataPrivacy, priceEscalation, escalationPct, notes)
[ ] Create `src/data/demoAnswers.js` with canned answers for all 5 demo questions
[ ] Each demo answer must include: answer string, citations array, queryPlan array (3+ steps)

---

## PHASE 3 — API layer
[ ] Create `src/lib/foundry.js`
[ ] Implement `retrieveFromKnowledgeBase(query, history)` per CLAUDE.md spec
[ ] Implement `chatWithAgent(query, history)` per CLAUDE.md spec
[ ] Implement `askContract(query, history)` — routes between the two, falls back to demo mode
[ ] Test demo mode: call `askContract('auto-renew', [])` with no credentials — must return demo answer without throwing
[ ] Test connection: if credentials are in .env.local, call the search endpoint manually and log the HTTP status (not the full response or the key)

---

## PHASE 4 — Left panel (Dashboard)
[ ] Build `Header.jsx` — logo, Foundry IQ badge, connection status dot
[ ] Wire connection status test on mount (see CLAUDE.md connection status spec)
[ ] Build `StatRow.jsx` — 3 stat cards derived from contracts array (total, urgent count, auto-renew count)
[ ] Build `AlertStrip.jsx` — shows only when urgent contracts exist, lists them with days remaining
[ ] Build `ContractCard.jsx` — vendor name, status badge, renewal date, annual value, notice period, auto-renew flag, DPA flag
[ ] Status badge logic: urgent (window open + auto-renew) → red / warning (window open, no auto-renew) → amber / ok → green
[ ] Build `ContractList.jsx` — scrollable list of ContractCard, selected state highlights in accent blue
[ ] Clicking a ContractCard pre-fills the chat input with: "Tell me about the {vendor} contract — key terms, renewal, and any fine print."

---

## PHASE 5 — To-do list
[ ] Build `TodoList.jsx`
[ ] Implement auto-task generation rules from CLAUDE.md (all 4 rules)
[ ] Tasks sorted: urgent → warning → normal
[ ] Completed tasks move to bottom with strikethrough
[ ] Clicking a task highlights the matching ContractCard in ContractList
[ ] Each task has an "Ask agent →" button that fires the pre-built chat question
[ ] Panel header badge shows count of incomplete urgent tasks
[ ] Verify: on fresh load, Meridian Cloud Hosting generates at least one urgent task automatically

---

## PHASE 6 — Chat panel (right side)
[ ] Build `ChatTopbar.jsx` — shows query plan steps animating in during loading, checkmarks after
[ ] Build `Message.jsx` — user bubble (right-aligned, accent tint) and assistant bubble (left-aligned, surface-3)
[ ] Assistant message includes: answer text, citations row, query plan trace (collapsible is fine)
[ ] Build `MessageList.jsx` — scrollable, auto-scrolls to bottom on new message
[ ] Build `ChatInput.jsx` — textarea (auto-grow), send button, keyboard shortcut hint
[ ] Enter sends, Shift+Enter inserts newline
[ ] Send button disabled while loading or input is empty
[ ] Build `useChat.js` hook — manages messages array, loading state, conversation history (last 6 turns)
[ ] Build `QueryChips.jsx` — 5 chips, clicking fires sendMessage immediately
[ ] Wire everything together in `ChatPanel.jsx`

---

## PHASE 7 — Integration test (demo mode)
Run all 5 demo questions and verify each one:
[ ] "Which contracts auto-renew in the next 90 days?" → answer mentions Meridian + Apex + CleanCo, 3 citations, 3 query plan steps visible
[ ] "Which vendors have a price escalation clause?" → answer mentions Meridian + Brightline + Vantage, citations visible
[ ] "Which contracts carry data-privacy obligations?" → answer mentions Meridian + Apex only
[ ] "What's our largest annual vendor commitment?" → Northside Staffing ($220k) listed first
[ ] "Summarize all notice periods by vendor" → all 7 vendors listed

[ ] Alert strip shows Meridian and Apex as urgent on fresh load
[ ] Clicking Meridian task in TodoList → chat fires correct question → demo answer appears with citations
[ ] Connection status shows "Demo mode" (gray dot) when no credentials
[ ] No console errors on any of the above

---

## PHASE 8 — Live connection test (only if credentials are in .env.local)
[ ] Connection status dot turns green on load
[ ] Ask "Which contracts auto-renew in the next 90 days?" against real KB — answer returns without error
[ ] Citations reference real document filenames from the blob container
[ ] Query plan steps appear in topbar during loading
[ ] If agent ID is set, verify chatWithAgent path works (check network tab for correct endpoint)

---

## PHASE 9 — Polish and repo prep
[ ] Verify app title in index.html: "Contoso Contract Intelligence — Foundry IQ"
[ ] Verify all 7 contract cards render without layout overflow at 1280px width
[ ] Verify chat panel scrolls independently of left panel
[ ] Check .gitignore one final time — .env.local must not appear in `git status`
[ ] Create `README.md` with:
    - What the app does (2-3 sentences)
    - Architecture diagram (ASCII is fine)
    - How to run locally (npm install + npm run dev)
    - Data disclosure line: "This project uses a synthetic, fictional document set. No real, confidential, or personally identifiable data is used. No credentials are committed to this repository."
    - Hackathon track: Reasoning Agents / Foundry IQ
[ ] Final check: `npm run build` completes without errors

---

## DONE
When all boxes are checked, notify the team:
- App runs at http://localhost:5173
- Demo mode works with no credentials
- Live mode works with .env.local populated
- README and .gitignore are clean
- Ready for screen recording
