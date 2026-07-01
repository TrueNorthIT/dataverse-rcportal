import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind v4 is wired in as a Vite plugin — no separate postcss/tailwind.config file.
  plugins: [react(), tailwindcss()],
})
