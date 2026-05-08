// UNIT_TYPE=Hook
// useVoice — browser Speech Recognition (mic) + Speech Synthesis (speaker)
// Uses Web Speech API: SpeechRecognition for STT, SpeechSynthesis for TTS.
// Degrades gracefully when API is unavailable (speechSupported / ttsSupported flags).

import { ref } from 'vue'

type ListenCallback = (transcript: string) => void

export function useVoice() {
  const isListening = ref(false)
  const isSpeaking = ref(false)
  const voiceError = ref<string | null>(null)

  let recognition: any = null

  const speechSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition)

  const ttsSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window

  function startListening(onResult: ListenCallback): void {
    if (!speechSupported) {
      voiceError.value = 'Speech recognition not supported — try Chrome or Edge.'
      return
    }
    voiceError.value = null
    const SpeechRecognitionClass =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition
    recognition = new SpeechRecognitionClass()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => { isListening.value = true }
    recognition.onend = () => { isListening.value = false }
    recognition.onerror = (e: any) => {
      isListening.value = false
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        voiceError.value = `Mic error: ${e.error}`
      }
    }
    recognition.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript
      onResult(transcript)
    }
    recognition.start()
  }

  function stopListening(): void {
    recognition?.stop()
    isListening.value = false
  }

  function speak(text: string): void {
    if (!ttsSupported) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.93
    utterance.pitch = 1.0
    utterance.onstart = () => { isSpeaking.value = true }
    utterance.onend = () => { isSpeaking.value = false }
    utterance.onerror = () => { isSpeaking.value = false }
    window.speechSynthesis.speak(utterance)
    isSpeaking.value = true
  }

  function stopSpeaking(): void {
    window.speechSynthesis.cancel()
    isSpeaking.value = false
  }

  return {
    isListening,
    isSpeaking,
    voiceError,
    speechSupported,
    ttsSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  }
}
