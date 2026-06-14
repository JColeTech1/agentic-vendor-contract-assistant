#!/usr/bin/env bash
# Two-click launcher for macOS / Linux.
# macOS: double-click this file (you may need: right-click → Open the first time).
# Linux: run ./start.command  (or double-click if your file manager allows).
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js v20.6+ is required: https://nodejs.org"
  read -r -p "Press Enter to exit..."
  exit 1
fi

# First run: create .env.local from the template, open it for editing, then stop.
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local — paste your API keys (see SETUP.md), save, then run this again."
  (open -t .env.local 2>/dev/null || xdg-open .env.local 2>/dev/null || "${EDITOR:-nano}" .env.local)
  exit 0
fi

# Dependencies (first run only)
[ -d node_modules ] || npm install || { echo "npm install failed"; read -r -p "Press Enter to exit..."; exit 1; }

# Start API proxy + web app; stop both when this window is closed (Ctrl+C).
npm run server & SRV=$!
npm run dev & WEB=$!
trap 'kill $SRV $WEB 2>/dev/null' EXIT INT TERM

sleep 6
(open http://localhost:5173 2>/dev/null || xdg-open http://localhost:5173 2>/dev/null) || \
  echo "Open http://localhost:5173 in your browser."

echo "Running. Press Ctrl+C (or close this window) to stop."
wait
