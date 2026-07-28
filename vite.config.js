import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// When building for GitHub Pages the repo lives at /ram-rush/, so Vite
// needs that as the base path. Local dev uses "/" so asset URLs stay simple.
const base = process.env.GITHUB_PAGES ? "/ram-rush/" : "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Ram Rush · Draft Order",
        short_name: "Ram Rush",
        description: "Run the gauntlet to lock in your fantasy draft order.",
        theme_color: "#003594",
        background_color: "#003594",
        display: "standalone",
        start_url: base,
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
