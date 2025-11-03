/**
 * 🔧 Configuration ARCHON V3
 *
 * Détecte automatiquement si on est en local ou sur le réseau
 * et configure les URLs en conséquence
 */

// Détecter l'hôte actuel
const getHost = () => {
  // Si on accède depuis localhost ou 127.0.0.1, on reste en local
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'localhost';
  }

  // Sinon, utiliser l'IP du serveur (l'hôte actuel)
  return window.location.hostname;
};

const HOST = getHost();
const IS_LOCAL = HOST === 'localhost';

// Détecter si on est sur Vercel (ou autre plateforme distante)
const isOnVercel = () => {
  return window.location.hostname.includes('vercel.app') ||
         window.location.hostname.includes('ngrok');
};

// URL du backend Claude Code (bridge HTTP)
const getClaudeCodeUrl = () => {
  // Si on est sur Vercel, utiliser le tunnel ngrok
  if (isOnVercel()) {
    return 'https://elena-draftier-sloppily.ngrok-free.dev';
  }

  // Sinon, utiliser localhost
  return 'http://localhost:3334';
};

export const config = {
  // WebSocket Bridge (Saint Graal) - pas utilisé en mode distant
  WS_BRIDGE_URL: `ws://${HOST}:8765`,

  // Backend Claude Code (HTTP Bridge)
  BACKEND_URL: getClaudeCodeUrl(),

  // Backend TTS/STT (Voice Platform) - pas utilisé en mode texte uniquement
  VOICE_BACKEND_URL: `http://${HOST}:5000`,

  // Ollama (toujours localhost pour sécurité)
  OLLAMA_URL: 'http://localhost:11434',

  // Environnement
  IS_LOCAL: IS_LOCAL,
  HOST: HOST,
  IS_VERCEL: isOnVercel(),
};

console.log('📡 [Config] ARCHON V3 Configuration:');
console.log(`   - Host: ${config.HOST}`);
console.log(`   - WebSocket: ${config.WS_BRIDGE_URL}`);
console.log(`   - Claude Code Backend: ${config.BACKEND_URL}`);
console.log(`   - Voice Backend: ${config.VOICE_BACKEND_URL}`);
console.log(`   - Local: ${config.IS_LOCAL}`);
console.log(`   - Vercel: ${config.IS_VERCEL}`);

export default config;
