import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Génère automatiquement un certificat SSL local
  ],
  server: {
    host: '0.0.0.0', // Écoute sur toutes les interfaces (permet accès réseau local)
    port: 5173,
    strictPort: false,
    https: true, // Active HTTPS avec le certificat auto-signé
  }
})
