/**
 * 🌉 WebSocket Bridge Hook pour ARCHON V3
 *
 * Connecte ARCHON V3 au Saint Graal (WS Bridge Hub) pour communication
 * en temps réel avec Claude Code et autres applications.
 *
 * Created: 2025-11-02
 */

import { useEffect, useRef, useState } from 'react';
import config from './config';

const WS_URL = config.WS_BRIDGE_URL;
const RECONNECT_INTERVAL = 5000; // 5 secondes

export function useWebSocketBridge(onClaudeResponse) {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [clientId, setClientId] = useState(null);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      console.log('🌉 [WS Bridge] Connexion au Saint Graal...');

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;

          console.log('✅ [WS Bridge] Connecté au Saint Graal');
          setIsConnected(true);

          // Handshake
          ws.send(JSON.stringify({
            type: 'handshake',
            name: 'ARCHON V3',
            clientType: 'archon'
          }));
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;

          try {
            const message = JSON.parse(event.data);

            switch (message.type) {
              case 'welcome':
                setClientId(message.clientId);
                console.log(`🎉 [WS Bridge] Bienvenue! Client ID: ${message.clientId}`);
                break;

              case 'handshake-ack':
                console.log('👋 [WS Bridge] Handshake confirmé');
                break;

              case 'client-joined':
                console.log(`👤 [WS Bridge] Client rejoint: ${message.name} (${message.clientType})`);
                break;

              case 'client-left':
                console.log(`👋 [WS Bridge] Client parti: ${message.name}`);
                break;

              case 'claude-response':
                // Réponse de Claude Code → afficher et vocaliser
                console.log(`🤖 [WS Bridge] Réponse de Claude: "${message.content?.substring(0, 50)}..."`);
                if (onClaudeResponse && message.content) {
                  onClaudeResponse(message.content, message);
                }
                break;

              case 'pong':
                console.log('🏓 [WS Bridge] Pong reçu');
                break;

              case 'error':
                console.error(`❌ [WS Bridge] Erreur serveur: ${message.message}`);
                break;

              case 'server-shutdown':
                console.warn(`🛑 [WS Bridge] ${message.message}`);
                break;

              default:
                console.log(`📨 [WS Bridge] Message (${message.type}):`, message);
            }
          } catch (err) {
            console.error('❌ [WS Bridge] Erreur parsing message:', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;

          console.log('🔌 [WS Bridge] Déconnecté du Saint Graal');
          setIsConnected(false);
          setClientId(null);

          // Tentative de reconnexion automatique
          reconnectTimerRef.current = setTimeout(() => {
            if (isMounted) {
              console.log('🔄 [WS Bridge] Tentative de reconnexion...');
              connect();
            }
          }, RECONNECT_INTERVAL);
        };

        ws.onerror = (error) => {
          console.error('❌ [WS Bridge] Erreur WebSocket:', error);
        };

      } catch (error) {
        console.error('❌ [WS Bridge] Erreur création WebSocket:', error);

        // Réessayer après un délai
        reconnectTimerRef.current = setTimeout(() => {
          if (isMounted) {
            connect();
          }
        }, RECONNECT_INTERVAL);
      }
    }

    // Connexion initiale
    connect();

    // Cleanup
    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [onClaudeResponse]);

  /**
   * Envoyer une commande vocale au Saint Graal
   */
  const sendVoiceCommand = (content) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ [WS Bridge] Non connecté - impossible d\'envoyer le message');
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'archon-command',
        content: content,
        sender: 'ARCHON V3',
        timestamp: new Date().toISOString()
      }));

      console.log(`➡️ [WS Bridge] Commande vocale envoyée: "${content.substring(0, 50)}..."`);
      return true;
    } catch (error) {
      console.error('❌ [WS Bridge] Erreur envoi:', error);
      return false;
    }
  };

  /**
   * Ping le serveur
   */
  const ping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
      return true;
    } catch (error) {
      console.error('❌ [WS Bridge] Erreur ping:', error);
      return false;
    }
  };

  return {
    isConnected,
    clientId,
    sendVoiceCommand,
    ping
  };
}
