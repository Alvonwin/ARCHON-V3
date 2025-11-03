import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
import VoiceInput from './VoiceInput'
import { useWebSocketBridge } from './useWebSocketBridge'
import config from './config'

function App() {
  const [messages, setMessages] = useState(() => {
    // Charger historique au démarrage
    const saved = localStorage.getItem('archon_messages')
    return saved ? JSON.parse(saved) : []
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [handsFreeModeEnabled, setHandsFreeModeEnabled] = useState(true)
  const [systemPrompt, setSystemPrompt] = useState('') // Prompt dynamique
  const [isStarted, setIsStarted] = useState(false) // Pour gérer autoplay audio
  const [aiMode, setAiMode] = useState('claude') // 'gpt4all' ou 'claude' - DÉFAUT: Claude Code
  const messagesEndRef = useRef(null)
  const voiceInputRef = useRef(null)
  const audioContextRef = useRef(null) // AudioContext global pour TTS
  const audioElementRef = useRef(null) // Audio element réutilisable pour TTS

  // 🌉 WebSocket Bridge - Connexion au Saint Graal
  const handleClaudeResponseFromBridge = useCallback((content, fullMessage) => {
    console.log('🌉 [Bridge] Réponse de Claude reçue via WebSocket:', content.substring(0, 100) + '...')

    // Ajouter le message à l'historique
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: content,
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      source: 'websocket-bridge'
    }])

    // Si mode mains libres: vocaliser automatiquement
    if (handsFreeModeEnabled) {
      setTimeout(() => {
        speakText(content)
      }, 500)
    }
  }, [handsFreeModeEnabled])

  const wsBridge = useWebSocketBridge(handleClaudeResponseFromBridge)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Charger prompt dynamique au démarrage
  useEffect(() => {
    const loadSystemPrompt = async () => {
      try {
        const response = await fetch(`${config.BACKEND_URL}/claude-resurrection`)
        const data = await response.json()

        // Extraire section pertinente du CLAUDE_RESURRECTION
        const content = data.content
        setSystemPrompt(content)
        console.log('✅ Prompt système chargé depuis CLAUDE_RESURRECTION.md')
      } catch (error) {
        console.error('❌ Erreur chargement prompt:', error)
        // Fallback: prompt minimal
        setSystemPrompt(`Tu es ARCHON, assistant IA local fonctionnant avec Mistral 7B.

Tu travailles avec Alain sur un projet de préservation de mémoire. Sois concis, proactif et autonome. Réponds toujours en français avec tutoiement.`)
      }
    }

    loadSystemPrompt()
  }, [])

  // Sauvegarder automatiquement les messages (localStorage + backend)
  useEffect(() => {
    if (messages.length > 0) {
      // localStorage (rapide)
      localStorage.setItem('archon_messages', JSON.stringify(messages))

      // Backend (Mémoire V3) - debounced
      const saveToBackend = setTimeout(async () => {
        try {
          await fetch(`${config.BACKEND_URL}/save-memory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
          })
          console.log('✅ Sauvegardé en Mémoire V3')
        } catch (error) {
          console.log('⚠️  Backend sauvegarde non disponible:', error.message)
        }
      }, 3000) // Attendre 3s après dernier message

      return () => clearTimeout(saveToBackend)
    }
  }, [messages])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Démarrer capture vocale automatiquement en mode mains libres
  useEffect(() => {
    if (handsFreeModeEnabled && voiceInputRef.current && isStarted) {
      // Attendre 2s pour que tout soit chargé
      const timer = setTimeout(() => {
        console.log('🎙️ Mode mains libres: démarrage auto de la capture')
        voiceInputRef.current?.startRecording()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [handsFreeModeEnabled, isStarted])

  const clearHistory = () => {
    if (confirm('Effacer tout l\'historique des conversations ?')) {
      setMessages([])
      localStorage.removeItem('archon_messages')
    }
  }

  const exportHistory = () => {
    const dataStr = JSON.stringify(messages, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `archon_conversation_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const saveToMemoryV3 = () => {
    // Format markdown pour Mémoire V3
    const timestamp = new Date().toISOString()
    const date = timestamp.split('T')[0]

    let markdown = `# Conversation ARCHON V3 - ${date}\n\n`
    markdown += `**Timestamp**: ${timestamp}\n`
    markdown += `**Nombre de messages**: ${messages.length}\n`
    markdown += `**Mode**: Assistant IA Local (Mistral 7B)\n\n`
    markdown += `---\n\n`

    messages.forEach((msg, i) => {
      const role = msg.role === 'user' ? '👤 **Alain**' : '🤖 **ARCHON**'
      markdown += `### ${role} (${msg.timestamp})\n\n`
      markdown += `${msg.content}\n\n`
      markdown += `---\n\n`
    })

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `archon_${date}_${messages.length}msg.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleVoiceTranscript = (transcript) => {
    // Mode mains libres: envoi direct
    if (handsFreeModeEnabled && transcript.trim()) {
      sendMessageDirect(transcript)
    } else {
      // Mode normal: ajouter au champ input
      setInput(prev => prev ? `${prev} ${transcript}` : transcript)
    }
  }

  // Système de sons de notification
  const playSound = (soundType) => {
    try {
      const audioContext = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)()
      if (!audioContextRef.current) {
        audioContextRef.current = audioContext
      }

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Différents sons selon le type
      switch (soundType) {
        case 'recording-start':
          // Son ascendant (do-mi-sol)
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime) // Do
          oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1) // Mi
          oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2) // Sol
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.3)
          console.log('🔴 Son: Début enregistrement')
          break

        case 'recording-stop':
          // Son descendant (sol-mi-do)
          oscillator.frequency.setValueAtTime(784, audioContext.currentTime) // Sol
          oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1) // Mi
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime + 0.2) // Do
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.3)
          console.log('⏹️ Son: Fin enregistrement')
          break

        case 'message-sent':
          // Bip montant rapide
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
          oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1)
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.15)
          console.log('📤 Son: Message envoyé')
          break

        case 'message-received':
          // Double bip doux
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.15)
          gainNode.gain.setValueAtTime(0.25, audioContext.currentTime)
          gainNode.gain.setValueAtTime(0.25, audioContext.currentTime + 0.15)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.3)
          console.log('📥 Son: Message reçu')
          break

        case 'tts-start':
          // Triple bip rapide
          const osc1 = audioContext.createOscillator()
          const osc2 = audioContext.createOscillator()
          const osc3 = audioContext.createOscillator()
          const gain = audioContext.createGain()

          osc1.connect(gain)
          osc2.connect(gain)
          osc3.connect(gain)
          gain.connect(audioContext.destination)

          osc1.frequency.value = 700
          osc2.frequency.value = 700
          osc3.frequency.value = 700

          gain.gain.setValueAtTime(0.15, audioContext.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)

          osc1.start(audioContext.currentTime)
          osc1.stop(audioContext.currentTime + 0.08)

          osc2.start(audioContext.currentTime + 0.1)
          osc2.stop(audioContext.currentTime + 0.18)

          osc3.start(audioContext.currentTime + 0.2)
          osc3.stop(audioContext.currentTime + 0.28)

          console.log('🔊 Son: Début vocalisation')
          return // Skip oscillator cleanup (already stopped)

        case 'error':
          // Son d'erreur (basse fréquence)
          oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.4)
          console.log('❌ Son: Erreur')
          break

        default:
          // Son neutre
          oscillator.frequency.value = 440
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.2)
      }
    } catch (error) {
      console.error('❌ Erreur playSound:', error)
    }
  }

  const speakText = async (text) => {
    console.log('🔊 speakText appelé avec:', text.substring(0, 50))
    try {
      const response = await fetch(`${config.VOICE_BACKEND_URL}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })

      console.log('📡 Réponse TTS:', response.status)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const audioBlob = await response.blob()
      console.log('🎵 Audio blob reçu, taille:', audioBlob.size)

      // Utiliser l'élément audio réutilisable
      const audio = audioElementRef.current
      if (!audio) {
        console.error('❌ Audio element non initialisé!')
        if (handsFreeModeEnabled) {
          setTimeout(() => voiceInputRef.current?.startRecording(), 1000)
        }
        return
      }

      const audioUrl = URL.createObjectURL(audioBlob)

      // Nettoyer les anciens listeners
      audio.onended = null
      audio.onerror = null

      // Configurer le nouveau src
      audio.src = audioUrl
      audio.volume = 1.0
      audio.preload = 'auto'
      console.log('🎵 Audio source mise à jour, volume:', audio.volume)

      // Cleanup function
      let cleanedUp = false
      const cleanup = () => {
        if (!cleanedUp) {
          URL.revokeObjectURL(audioUrl)
          cleanedUp = true
          console.log('🧹 Object URL libéré')
        }
      }

      // Mode mains libres: reprendre écoute après lecture
      if (handsFreeModeEnabled) {
        console.log('🎙️ Mode mains libres: audio.onended configuré')
        audio.onended = () => {
          console.log('✅ Audio terminé, redémarrage capture dans 1s')
          cleanup()
          setTimeout(() => {
            voiceInputRef.current?.startRecording()
          }, 1000)
        }

        // Détection intelligente de fin d'audio (comme détection silence sur micro)
        let lastTime = 0
        let stuckCount = 0
        const progressCheckInterval = setInterval(() => {
          if (audio.paused || audio.ended) {
            clearInterval(progressCheckInterval)
            return
          }

          const currentTime = audio.currentTime

          // Si l'audio ne progresse pas
          if (Math.abs(currentTime - lastTime) < 0.1) {
            stuckCount++
            console.log(`⏸️ Audio ne progresse pas (${stuckCount}/4)`)

            // Si bloqué pendant 2 secondes (4 checks × 500ms)
            if (stuckCount >= 4) {
              console.warn('⚠️ Audio bloqué - considéré comme terminé')
              clearInterval(progressCheckInterval)
              audio.pause()
              audio.currentTime = 0
              cleanup()
              voiceInputRef.current?.startRecording()
            }
          } else {
            // L'audio progresse normalement
            stuckCount = 0
            lastTime = currentTime
          }
        }, 500) // Check toutes les 500ms

        // Timeout de sécurité très long (10 minutes) au cas où
        const safetyTimeoutId = setTimeout(() => {
          console.warn('⚠️ Timeout sécurité 10min - arrêt forcé')
          clearInterval(progressCheckInterval)
          audio.pause()
          audio.currentTime = 0
          cleanup()
          voiceInputRef.current?.startRecording()
        }, 600000) // 10 minutes

        audio.addEventListener('ended', () => {
          clearInterval(progressCheckInterval)
          clearTimeout(safetyTimeoutId)
        }, { once: true })
      }

      console.log('▶️ Tentative lecture audio...')

      // Son de notification avant vocalisation
      playSound('tts-start')

      const playPromise = audio.play()

      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('✅ Audio en lecture - SUCCÈS!')
          console.log(`   Duration: ${audio.duration}s`)
          console.log(`   Volume: ${audio.volume}`)
          console.log(`   CurrentTime: ${audio.currentTime}s`)
        }).catch(err => {
          console.error('❌ ERREUR lecture audio:', err.name, '|', err.message)
          console.error(`   Audio readyState: ${audio.readyState}`)
          console.error(`   Audio networkState: ${audio.networkState}`)
          console.error(`   Audio paused: ${audio.paused}`)
          cleanup()
          // Reprendre capture quand même si audio échoue
          if (handsFreeModeEnabled) {
            setTimeout(() => {
              voiceInputRef.current?.startRecording()
            }, 1000)
          }
        })
      }
    } catch (error) {
      console.error('❌ Erreur TTS:', error)
      // Reprendre capture quand même
      if (handsFreeModeEnabled) {
        setTimeout(() => {
          voiceInputRef.current?.startRecording()
        }, 1000)
      }
    }
  }

  // Fonction pour détecter les phrases complètes et vocaliser
  const speakSentenceQueue = useRef([]) // Queue de phrases à vocaliser
  const isSpeaking = useRef(false) // Flag pour savoir si on est en train de parler

  // Fonction pour nettoyer le markdown avant TTS
  const cleanMarkdownForTTS = (text) => {
    let cleaned = text

    // Enlever les blocs de code (``` ... ```)
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '')

    // Enlever le code inline mais garder le contenu (`code` -> code)
    cleaned = cleaned.replace(/`(.+?)`/g, '$1')

    // Enlever les emojis
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '')
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '')

    // Enlever les titres markdown (## ### etc) mais GARDER le texte
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '')

    // Enlever les ** et __ (bold) mais GARDER le contenu
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1')
    cleaned = cleaned.replace(/__(.+?)__/g, '$1')

    // Enlever les * et _ (italic) mais GARDER le contenu
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1')
    cleaned = cleaned.replace(/_(.+?)_/g, '$1')

    // Enlever les bullets et listes - ajouter une virgule
    cleaned = cleaned.replace(/^[\-\*\+]\s+/gm, ', ')
    cleaned = cleaned.replace(/^\d+\.\s+/gm, ', ')

    // Enlever les liens markdown [text](url) -> text
    cleaned = cleaned.replace(/\[(.+?)\]\(.+?\)/g, '$1')

    // Enlever les chevrons (citations)
    cleaned = cleaned.replace(/^>\s+/gm, '')

    // Enlever les lignes horizontales
    cleaned = cleaned.replace(/^[\-\*_]{3,}$/gm, '')

    // Nettoyer les espaces multiples
    cleaned = cleaned.replace(/\s+/g, ' ')

    // Nettoyer les virgules multiples
    cleaned = cleaned.replace(/,\s*,/g, ',')

    return cleaned.trim()
  }

  const processSpeechQueue = async () => {
    if (isSpeaking.current || speakSentenceQueue.current.length === 0) return

    isSpeaking.current = true
    const sentence = speakSentenceQueue.current.shift()

    // Le texte est DÉJÀ nettoyé avant d'entrer dans la queue
    console.log('🔊 Vocalisation:', sentence)

    try {
      await speakText(sentence)
    } catch (error) {
      console.error('❌ Erreur TTS sentence:', error)
    }

    isSpeaking.current = false

    // Continuer avec la prochaine phrase
    if (speakSentenceQueue.current.length > 0) {
      setTimeout(processSpeechQueue, 100)
    }
  }

  const sendToClaudeCode = async (userMessage, assistantIndex) => {
    // Mode Claude Code: Stream SSE en temps réel
    try {
      console.log('📤 Envoi à Claude Code via SSE stream')

      // Envoyer le message
      const response = await fetch(`${config.BACKEND_URL}/claude-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userMessage })
      })

      if (!response.ok) {
        throw new Error('Erreur backend Claude')
      }

      console.log('✅ Message envoyé, connexion SSE...')

      // Se connecter au stream SSE
      const eventSource = new EventSource(`${config.BACKEND_URL}/claude-stream`)
      let fullText = ''
      let sentenceBuffer = '' // Buffer pour accumuler jusqu'à avoir une phrase complète
      let alreadySpoken = new Set() // Track des phrases déjà vocalisées pour éviter doublons
      let stabilityTimer = null // Timer pour détecter fin de stream
      let hasVocalized = false // Flag pour éviter double vocalisation

      const vocalizeComplete = () => {
        if (hasVocalized) return // Éviter double vocalisation
        hasVocalized = true

        console.log('📡 Stream stabilisé - vocalisation complète')
        eventSource.close()

        // Vocaliser le texte COMPLET une fois terminé
        if (fullText.trim() && handsFreeModeEnabled) {
          const cleaned = cleanMarkdownForTTS(fullText)
          console.log('🔊 Vocalisation complète:', cleaned.substring(0, 100) + '...')
          playSound('message-received') // Son de notification
          speakSentenceQueue.current.push(cleaned)
          processSpeechQueue()
        }
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const delta = data.delta

          if (delta) {
            fullText = data.full

            // Mettre à jour l'affichage en temps réel
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[assistantIndex] = {
                ...newMessages[assistantIndex],
                content: fullText
              }
              return newMessages
            })

            // RESET le timer de stabilité à chaque nouveau delta
            if (stabilityTimer) {
              clearTimeout(stabilityTimer)
            }

            // Si pas de nouveau contenu pendant 2 secondes, on considère le stream terminé
            stabilityTimer = setTimeout(() => {
              vocalizeComplete()
            }, 2000) // 2 secondes de silence = stream terminé
          }
        } catch (err) {
          console.error('❌ Erreur parsing SSE:', err)
        }
      }

      eventSource.onerror = (error) => {
        console.log('📡 SSE error event - vocalisation complète')
        if (stabilityTimer) clearTimeout(stabilityTimer)
        vocalizeComplete()
      }

      // Timeout de sécurité (2 minutes)
      setTimeout(() => {
        if (stabilityTimer) clearTimeout(stabilityTimer)
        eventSource.close()
        console.log('⏱️ SSE timeout fermé')
      }, 120000)

    } catch (error) {
      console.error('❌ Erreur communication Claude Code:', error)
      throw error
    }
  }

  const sendMessageDirect = async (message) => {
    if (!message.trim() || isLoading) return

    const userMessage = message.trim()

    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toLocaleTimeString('fr-FR')
    }])

    // 🌉 Envoyer la commande vocale via WebSocket Bridge
    wsBridge.sendVoiceCommand(userMessage)

    // Son d'envoi
    playSound('message-sent')

    setIsLoading(true)

    // Router selon le mode sélectionné
    if (aiMode === 'claude') {
      try {
        // Créer immédiatement le message assistant vide
        const assistantIndex = messages.length + 1
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '',
          timestamp: new Date().toLocaleTimeString('fr-FR')
        }])

        // Lancer le stream SSE qui mettra à jour ce message
        await sendToClaudeCode(userMessage, assistantIndex)

      } catch (error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Erreur Claude Code: ${error.message}. Vérifie que le bridge est actif.`,
          timestamp: new Date().toLocaleTimeString('fr-FR')
        }])
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Mode GPT4All (code existant)
    try {
      const response = await fetch(`${config.OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral',
          messages: [
            { role: 'system', content: systemPrompt || 'Tu es ARCHON, assistant IA local.' },
            { role: 'user', content: userMessage }
          ],
          stream: true
        })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      const assistantIndex = messages.length + 1

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString('fr-FR')
      }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            if (json.message?.content) {
              assistantMessage += json.message.content
              setMessages(prev => {
                const newMessages = [...prev]
                newMessages[assistantIndex] = {
                  ...newMessages[assistantIndex],
                  content: assistantMessage
                }
                return newMessages
              })
            }
          } catch (e) {}
        }
      }

      // Mode mains libres: auto-lecture de la réponse
      if (handsFreeModeEnabled && assistantMessage.trim()) {
        setTimeout(() => {
          speakText(assistantMessage)
        }, 500)
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Erreur: ${error.message}. Vérifie qu'Ollama tourne.`,
        timestamp: new Date().toLocaleTimeString('fr-FR')
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    sendMessageDirect(userMessage)
  }

  return (
    <div className="app">
      {!isStarted && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <h1 style={{ color: '#22c55e', fontSize: '3rem', marginBottom: '2rem' }}>ARCHON V3</h1>
          <p style={{ color: 'white', fontSize: '1.2rem', marginBottom: '3rem' }}>Assistant IA Local avec mode mains libres</p>
          <button
            onClick={async () => {
              // Créer AudioContext immédiatement
              if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
                console.log('🎛️ AudioContext créé au démarrage')
              }

              // Reprendre AudioContext
              if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume()
              }
              console.log('🔊 AudioContext state:', audioContextRef.current.state)

              // Créer élément Audio réutilisable avec technique "play-then-pause"
              if (!audioElementRef.current) {
                audioElementRef.current = new Audio()
                audioElementRef.current.volume = 1.0
                console.log('🎵 Audio element créé et prêt')
              }

              // Technique "play-then-pause": débloquer autoplay
              const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
              silentAudio.volume = 1.0
              try {
                await silentAudio.play()
                console.log('🔓 Tentative play silence...')
                silentAudio.pause()
                console.log('✅ Audio débloqué - play-then-pause réussi!')

                // Débloquer aussi l'élément réutilisable
                audioElementRef.current.src = silentAudio.src
                await audioElementRef.current.play()
                audioElementRef.current.pause()
                audioElementRef.current.src = ''
                console.log('✅ Audio element principal débloqué!')

                setIsStarted(true)
              } catch (err) {
                console.warn('⚠️ Autoplay partiellement bloqué:', err.message)
                setIsStarted(true) // Continuer quand même
              }
            }}
            style={{
              padding: '20px 40px',
              fontSize: '1.5rem',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)'
            }}
          >
            🚀 Démarrer ARCHON
          </button>
        </div>
      )}
      <header className="header">
        <h1>ARCHON V3</h1>
        <p>Assistant IA Local</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => setAiMode('gpt4all')}
            style={{
              padding: '8px 16px',
              backgroundColor: aiMode === 'gpt4all' ? '#f97316' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            🤖 Mode GPT4All
          </button>
          <button
            onClick={() => setAiMode('claude')}
            style={{
              padding: '8px 16px',
              backgroundColor: aiMode === 'claude' ? '#3b82f6' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            💻 Mode Claude Code
          </button>
          <button
            onClick={() => {
              setHandsFreeModeEnabled(!handsFreeModeEnabled)
              playSound(!handsFreeModeEnabled ? 'recording-start' : 'recording-stop')
            }}
            style={{
              padding: '12px 20px',
              backgroundColor: handsFreeModeEnabled ? '#22c55e' : '#ef4444',
              color: 'white',
              border: handsFreeModeEnabled ? '2px solid #16a34a' : '2px solid #dc2626',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '15px',
              animation: handsFreeModeEnabled ? 'pulse 2s infinite' : 'none',
              boxShadow: handsFreeModeEnabled ? '0 0 15px rgba(34, 197, 94, 0.5)' : 'none',
              transition: 'all 0.3s ease'
            }}
            title={handsFreeModeEnabled ? 'Cliquez pour PAUSE l\'écoute vocale' : 'Cliquez pour RÉSUMER l\'écoute vocale'}
          >
            {handsFreeModeEnabled ? '⏸️ PAUSE' : '▶️ RÉSUMER'}
          </button>
          <button
            onClick={saveToMemoryV3}
            disabled={messages.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              opacity: messages.length === 0 ? 0.5 : 1
            }}
          >
            🧠 Mémoire V3
          </button>
          <button
            onClick={exportHistory}
            disabled={messages.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              opacity: messages.length === 0 ? 0.5 : 1
            }}
          >
            💾 JSON
          </button>
          <button
            onClick={clearHistory}
            disabled={messages.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              opacity: messages.length === 0 ? 0.5 : 1
            }}
          >
            🗑️ Effacer
          </button>
        </div>
      </header>

      <div className="chat-container">
        <div className="messages">
          {messages.filter(msg => msg && msg.role).map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
              <div className="message-content">
                <div>{msg.content}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                  <small>{msg.timestamp}</small>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => speakText(msg.content)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '2px'
                      }}
                      title="Lire à voix haute"
                    >
                      🔊
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && <div>Réflexion...</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <VoiceInput ref={voiceInputRef} onTranscript={handleVoiceTranscript} playSound={playSound} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Message..."
            disabled={isLoading}
          />
          <button onClick={sendMessage} disabled={!input.trim() || isLoading}>
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
