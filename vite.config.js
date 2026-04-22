import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Import plugin v4
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Kích hoạt engine v4
  ],
  resolve: {
    alias: {
      // Đảm bảo alias @ hoạt động để tìm thấy /src/lib/utils
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    open: true
  }
})