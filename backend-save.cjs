const express = require('express')
const cors = require('cors')
const fs = require('fs').promises
const fsSync = require('fs')
const path = require('path')

const app = express()
const PORT = 3334

app.use(cors())
app.use(express.json())

const MEMORY_DIR = 'E:/Mémoire Claude/archon_conversations'
const CLAUDE_RESURRECTION = 'E:/Mémoire Claude/CLAUDE_RESURRECTION.md'

// Importer handlers V1 et V2 directement
const V1Handler = require('E:/Automation/Scripts/Python/hook_capture_v1_handler.js')
const V2Handler = require('E:/Automation/Scripts/Python/hook_capture_v2_handler.js')
const CognitiveAnalyzer = require('E:/Automation/Scripts/Python/cognitive_analyzer.js')

const v1Handler = new V1Handler()
const v2Handler = new V2Handler()
const analyzer = new CognitiveAnalyzer()

// Endpoint: Sauvegarder conversation en Mémoire V3 UNIFIÉE
app.post('/save-memory', async (req, res) => {
  try {
    const { messages } = req.body

    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'No messages provided' })
    }

    console.log(`📝 ARCHON→V3: Sauvegarde de ${messages.length} messages dans mémoire unifiée`)

    let successCount = 0

    // Pour chaque paire User+Assistant, envoyer à V1 et V2
    for (let i = 0; i < messages.length - 1; i += 2) {
      const userMsg = messages[i]
      const assistantMsg = messages[i + 1]

      if (userMsg && assistantMsg && userMsg.role === 'user' && assistantMsg.role === 'assistant') {
        const userContent = userMsg.content
        const assistantContent = assistantMsg.content

        console.log(`\n[Exchange ${i/2 + 1}/${Math.floor(messages.length/2)}]`)

        // Analyse cognitive avec metadata simple
        const metadata = {
          project: 'ARCHON',
          theme: ['conversation', 'vocal'],
          intent: 'dialogue',
          urgency: 'medium',
          interface: 'archon-vocal',
          keywords: []
        }

        // Sauvegarder via V1 (flux continu)
        try {
          v1Handler.capture(userContent, assistantContent)
          console.log('  V1 ✅')
        } catch (e) {
          console.log('  V1 ❌:', e.message)
        }

        // Sauvegarder via V2 (exchange individuel)
        try {
          const v2Result = await v2Handler.capture({
            userMessage: userContent,
            claudeResponse: assistantContent,
            metadata
          })
          if (v2Result.success) {
            console.log('  V2 ✅')
            successCount++
          } else {
            console.log('  V2 ❌:', v2Result.error)
          }
        } catch (e) {
          console.log('  V2 ❌:', e.message)
        }
      }
    }

    res.json({
      success: true,
      message: `${successCount} exchanges ARCHON sauvegardés dans V3 (mémoire unifiée)`,
      unified: true,
      exchanges_saved: successCount,
      interface: 'archon-vocal'
    })

    console.log(`\n✅ Total: ${successCount} exchanges ARCHON intégrés dans mémoire V3`)
  } catch (error) {
    console.error('❌ Erreur sauvegarde:', error)
    res.status(500).json({ error: error.message })
  }
})

// Endpoint: Lire CLAUDE_RESURRECTION.md
app.get('/claude-resurrection', async (req, res) => {
  try {
    const content = await fs.readFile(CLAUDE_RESURRECTION, 'utf-8')
    res.json({ content })
  } catch (error) {
    console.error('❌ Erreur lecture CLAUDE_RESURRECTION:', error)
    res.status(500).json({ error: error.message })
  }
})

// Endpoint: Lire dernières conversations ARCHON
app.get('/recent-memories', async (req, res) => {
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true })

    const files = await fs.readdir(MEMORY_DIR)
    const mdFiles = files
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 3) // 3 derniers fichiers

    const memories = []
    for (const file of mdFiles) {
      const content = await fs.readFile(path.join(MEMORY_DIR, file), 'utf-8')
      memories.push({ filename: file, content })
    }

    res.json({ memories })
  } catch (error) {
    console.error('❌ Erreur lecture mémoires:', error)
    res.status(500).json({ error: error.message })
  }
})

// Endpoint: Écrire dans current_conversation.txt pour Claude Code
app.post('/claude-input', async (req, res) => {
  try {
    const { text } = req.body
    if (!text) {
      return res.status(400).json({ error: 'No text provided' })
    }

    const conversationFile = 'E:/Mémoire Claude/current_conversation.txt'
    const timestamp = new Date().toLocaleTimeString('fr-FR')
    const entry = `## Alain: ${text}\n\n`

    // Append au fichier
    await fs.appendFile(conversationFile, entry, 'utf-8')
    console.log(`📤 Message d'Alain ajouté à current_conversation.txt`)

    res.json({ success: true, message: 'Message envoyé à Claude Code' })
  } catch (error) {
    console.error('❌ Erreur claude-input:', error)
    res.status(500).json({ error: error.message })
  }
})

// Endpoint: Lire la dernière réponse de Claude depuis voice_output_clean.txt
app.get('/claude-output', async (req, res) => {
  try {
    const outputFile = 'E:/Voice_Platform/bridge/voice_output_clean.txt'
    const lastSentFile = 'E:/Voice_Platform/bridge/.last_archon_response.txt'

    // Vérifier si le fichier existe
    if (!fsSync.existsSync(outputFile)) {
      return res.json({ response: '' })
    }

    const content = await fs.readFile(outputFile, 'utf-8')
    const trimmedContent = content.trim()

    if (!trimmedContent || trimmedContent.startsWith('#')) {
      return res.json({ response: '' })
    }

    // Vérifier si cette réponse a déjà été envoyée
    let lastSent = ''
    if (fsSync.existsSync(lastSentFile)) {
      lastSent = await fs.readFile(lastSentFile, 'utf-8')
    }

    if (trimmedContent === lastSent.trim()) {
      // Déjà envoyée
      return res.json({ response: '' })
    }

    // Marquer comme envoyée
    await fs.writeFile(lastSentFile, trimmedContent, 'utf-8')
    console.log(`📥 Réponse Claude reçue: ${trimmedContent.substring(0, 50)}...`)

    res.json({ response: trimmedContent })
  } catch (error) {
    console.error('❌ Erreur claude-output:', error)
    res.status(500).json({ error: error.message })
  }
})

// Endpoint: Stream temps réel des réponses de Claude via SSE
app.get('/claude-stream', async (req, res) => {
  // Configuration SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const conversationFile = 'E:/Mémoire Claude/current_conversation.txt'
  let lastSize = 0
  let lastClaudeContent = ''

  // Initialiser la taille du fichier
  if (fsSync.existsSync(conversationFile)) {
    lastSize = fsSync.statSync(conversationFile).size
  }

  console.log('📡 Client SSE connecté pour streaming Claude')

  // Fonction pour vérifier les nouveaux contenus de Claude
  const checkNewContent = async () => {
    try {
      if (!fsSync.existsSync(conversationFile)) return

      const currentSize = fsSync.statSync(conversationFile).size

      if (currentSize > lastSize) {
        const content = await fs.readFile(conversationFile, 'utf-8')
        const lines = content.split('\n')

        // Trouver le dernier bloc "## Claude:"
        let claudeStartIndex = -1
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].startsWith('## Claude:')) {
            claudeStartIndex = i
            break
          }
        }

        if (claudeStartIndex !== -1) {
          // Collecter tout le contenu depuis "## Claude:" jusqu'à la fin
          let responseLines = []
          for (let i = claudeStartIndex; i < lines.length; i++) {
            const line = lines[i]
            if (i === claudeStartIndex) {
              const firstLine = line.replace('## Claude:', '').trim()
              if (firstLine) responseLines.push(firstLine)
            } else if (line.startsWith('## Alain:')) {
              break
            } else if (line.trim()) {
              responseLines.push(line)
            }
          }

          const newClaudeContent = responseLines.join('\n').trim()

          // Si nouveau contenu différent du précédent
          if (newClaudeContent && newClaudeContent !== lastClaudeContent) {
            // Envoyer seulement le NOUVEAU texte (delta)
            const delta = newClaudeContent.substring(lastClaudeContent.length)

            if (delta) {
              res.write(`data: ${JSON.stringify({ delta, full: newClaudeContent })}\n\n`)
              console.log(`📤 SSE envoyé: ${delta.substring(0, 30)}...`)
            }

            lastClaudeContent = newClaudeContent
          }
        }

        lastSize = currentSize
      }
    } catch (error) {
      console.error('❌ Erreur SSE check:', error)
    }
  }

  // Polling toutes les 200ms
  const intervalId = setInterval(checkNewContent, 200)

  // Nettoyage à la déconnexion
  req.on('close', () => {
    clearInterval(intervalId)
    console.log('📡 Client SSE déconnecté')
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend ARCHON sauvegarde lancé sur 0.0.0.0:${PORT}`)
  console.log(`📁 Dossier mémoire: ${MEMORY_DIR}`)
  console.log(`🔗 Bridge Claude Code disponible sur /claude-input et /claude-output`)
  console.log(`🌐 Accessible sur réseau local via http://10.0.0.95:${PORT}`)
})
