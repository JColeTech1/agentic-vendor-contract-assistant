import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser never talks to Azure directly. It calls the relative path /api/ask,
// which Vite forwards to the local Node proxy (server.mjs) on :8799. That server
// holds the Entra credential — so no secret ever reaches the client bundle.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8799",
        changeOrigin: true,
      },
    },
  },
});
