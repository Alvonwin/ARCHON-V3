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

export const config = {
  // WebSocket Bridge (Saint Graal)
  WS_BRIDGE_URL: `ws://${HOST}:8765`,

  // Backend Claude Code
  BACKEND_URL: `http://${HOST}:3334`,

  // Backend TTS/STT (Voice Platform)
  VOICE_BACKEND_URL: `http://${HOST}:5000`,

  // Ollama (toujours localhost pour sécurité)
  OLLAMA_URL: 'http://localhost:11434',

  // Environnement
  IS_LOCAL: HOST === 'localhost',
  HOST: HOST,
};

console.log('📡 [Config] ARCHON V3 Configuration:');
console.log(`   - Host: ${config.HOST}`);
console.log(`   - WebSocket: ${config.WS_BRIDGE_URL}`);
console.log(`   - Backend: ${config.BACKEND_URL}`);
console.log(`   - Local: ${config.IS_LOCAL}`);

export default config;
