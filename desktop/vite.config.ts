import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*"],
      manifest: {
        name: "Diart — PDF zu Excel",
        short_name: "Diart",
        start_url: ".",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2563eb",
        icons: [
          { src: "icons/192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,png,svg,ico,webmanifest,traineddata}"],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
    }),
  ],
  // MuPDF.js uses top-level await; default Vite/esbuild targets (es2020) reject it in dev.
  esbuild: {
    target: "esnext",
  },
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["mupdf"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
  },
});

