import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import config from './config'

const VoiceInput = forwardRef(({ onTranscript, playSound }, ref) => {
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState('Prêt')
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const silenceTimeoutRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef = useRef(null)
  const startRecordingTimeoutRef = useRef(null)
  const isStartingRef = useRef(false)

  const startRecording = async () => {
    // Débounce: éviter appels multiples rapides
    if (isStartingRef.current) {
      console.log('⏸️ startRecording déjà en cours, ignoré')
      return
    }

    // Annuler tout démarrage précédent encore en attente
    if (startRecordingTimeoutRef.current) {
      clearTimeout(startRecordingTimeoutRef.current)
    }

    isStartingRef.current = true

    try {
      setStatus('Démarrage micro...')

      // Demander accès micro
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      streamRef.current = stream

      // Créer AudioContext pour analyse volume
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)
      microphone.connect(analyser)
      analyser.fftSize = 512

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      // Créer MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      })

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        setStatus('Transcription...')

        // Arrêter AudioContext
        if (audioContextRef.current) {
          audioContextRef.current.close()
        }

        // Créer blob audio
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        // Envoyer à Voice Platform pour transcription
        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const response = await fetch(`${config.VOICE_BACKEND_URL}/transcribe`, {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const data = await response.json()

          if (data.text) {
            console.log('Transcription:', data.text)
            onTranscript(data.text)
            setStatus('Prêt')
          } else {
            setStatus('Aucun texte détecté')
          }
        } catch (error) {
          console.error('Erreur transcription:', error)
          setStatus(`Erreur: ${error.message}. Voice Platform actif?`)
        }

        // Arrêter le stream
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setStatus('🎤 Parle... (2s silence = envoi)')

      // Son de début d'enregistrement
      if (playSound) playSound('recording-start')

      // Démarrer détection de silence
      detectSilence()

    } catch (error) {
      console.error('Erreur micro:', error)
      setStatus(`Erreur: ${error.message}`)
    } finally {
      // Libérer le flag après un délai de sécurité
      setTimeout(() => {
        isStartingRef.current = false
      }, 500)
    }
  }

  const detectSilence = () => {
    if (!analyserRef.current) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    let hasDetectedSound = false

    const checkAudio = () => {
      if (!analyserRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return

      analyserRef.current.getByteFrequencyData(dataArray)

      // Calculer volume moyen
      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i]
      }
      const average = sum / bufferLength

      // Seuil de silence (ajustable)
      const SILENCE_THRESHOLD = 10

      if (average > SILENCE_THRESHOLD) {
        // Son détecté
        hasDetectedSound = true

        // Réinitialiser timer silence
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current)
        }
        silenceTimeoutRef.current = setTimeout(() => {
          console.log('2s de silence détectées, arrêt enregistrement')
          stopRecording()
        }, 2000) // 2 secondes de silence
      } else if (hasDetectedSound && !silenceTimeoutRef.current) {
        // Premier silence détecté après avoir eu du son
        silenceTimeoutRef.current = setTimeout(() => {
          console.log('2s de silence détectées, arrêt enregistrement')
          stopRecording()
        }, 2000)
      }

      // Continuer à checker toutes les 100ms
      setTimeout(checkAudio, 100)
    }

    checkAudio()
  }

  const stopRecording = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      // Son de fin d'enregistrement
      if (playSound) playSound('recording-stop')
    }

    // Cleanup du stream micro
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop()
        console.log('🛑 Track micro arrêté:', track.kind)
      })
      streamRef.current = null
    }

    // Cleanup AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        console.log('🔇 AudioContext fermé')
      })
      audioContextRef.current = null
    }
  }

  // Exposer startRecording au parent via ref
  useImperativeHandle(ref, () => ({
    startRecording
  }))

  return (
    <div style={{ marginBottom: '10px', textAlign: 'center' }}>
      <button
        onClick={isRecording ? stopRecording : startRecording}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: isRecording ? '#ef4444' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          transition: 'all 0.2s'
        }}
      >
        {isRecording ? '⏹️ Arrêter' : '🎤 Parler'}
      </button>

      <div style={{ marginTop: '8px', fontSize: '13px', color: '#9ca3af', minHeight: '20px' }}>
        {status}
      </div>
    </div>
  )
})

VoiceInput.displayName = 'VoiceInput'

export default VoiceInput
