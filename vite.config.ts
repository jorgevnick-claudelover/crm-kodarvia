import fs from "node:fs"
import path from "node:path"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

/**
 * La app se publica en GitHub Pages bajo https://<usuario>.github.io/crm-kodarvia/,
 * así que todo (assets, router, manifiesto y service worker) cuelga de este prefijo.
 */
const BASE = "/crm-kodarvia/"

/**
 * GitHub Pages no sabe reescribir rutas a index.html, así que al recargar en
 * /crm-kodarvia/contactos serviría un 404. Su convención es que, si existe 404.html,
 * lo sirve en esas rutas: copiando index.html a 404.html la app arranca igual y el
 * router lee la URL real. Es lo más simple que funciona al recargar.
 */
function copiar404(): Plugin {
  return {
    name: "crm-404-para-github-pages",
    apply: "build",
    enforce: "post",
    closeBundle() {
      const salida = path.resolve(__dirname, "dist")
      const indice = path.join(salida, "index.html")
      if (!fs.existsSync(indice)) return
      fs.copyFileSync(indice, path.join(salida, "404.html"))
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "CRM Gestoría",
        short_name: "CRM",
        description: "Seguimiento de contactos y oportunidades",
        lang: "es-PE",
        id: BASE,
        scope: BASE,
        start_url: BASE,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0f766e",
        icons: [
          { src: `${BASE}icons/icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${BASE}icons/icon-512.png`, sizes: "512x512", type: "image/png" },
          { src: `${BASE}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: `${BASE}index.html`,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
      },
    }),
    copiar404(),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { host: true, port: 5173 },
})
