/* ============================================================
   AI INTERVIEW AGENT - VOICE ENGINE (STT & TTS & VISUALIZER)
   ============================================================ */

class VoiceEngine {
  constructor() {
    // Speech Recognition (STT)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.hasSTT = !!SpeechRecognition;
    this.recognition = this.hasSTT ? new SpeechRecognition() : null;

    // Speech Synthesis (TTS)
    this.hasTTS = 'speechSynthesis' in window;
    this.synth = window.speechSynthesis;

    // Settings
    this.isMuted = false;
    this.autoSpeak = true;
    this.autoSend = false;
    this.selectedVoice = null;
    this.speechRate = 1.0;
    this.isListening = false;
    this.isSpeaking = false;

    // Callbacks
    this.onTranscriptUpdate = null;
    this.onSpeechEnd = null;
    this.onListeningChange = null;
    this.onSpeakingChange = null;

    // Canvas visualizer animation
    this.animFrameId = null;
    this.canvas = null;
    this.ctx = null;

    this.initRecognition();
    this.initSynthesis();
  }

  /* ------------------------------------------------------------
     1. SPEECH RECOGNITION (STT)
     ------------------------------------------------------------ */
  initRecognition() {
    if (!this.hasSTT) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onListeningChange) this.onListeningChange(true);
      this.startVisualizer('mic');
      this.playChime(600, 0.1); // Mic on tone
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentText = finalTranscript || interimTranscript;
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(currentText, !!finalTranscript);
      }
    };

    this.recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      this.stopListening();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onListeningChange) this.onListeningChange(false);
      this.stopVisualizer();
    };
  }

  toggleListening() {
    if (!this.hasSTT) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (this.isListening) {
      this.stopListening();
    } else {
      // If AI is speaking, stop it first
      this.stopSpeaking();
      try {
        this.recognition.start();
      } catch (e) {
        console.warn("Recognition start error:", e);
      }
    }
  }

  stopListening() {
    if (this.hasSTT && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      if (this.onListeningChange) this.onListeningChange(false);
      this.stopVisualizer();
    }
  }

  /* ------------------------------------------------------------
     2. SPEECH SYNTHESIS (TTS)
     ------------------------------------------------------------ */
  initSynthesis() {
    if (!this.hasTTS) return;

    // Load available voices
    const populateVoices = () => {
      const voices = this.synth.getVoices();
      // Prefer high quality English voices (Google, Microsoft, Apple)
      this.selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Guy') || v.name.includes('Jenny'))) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    };

    populateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = populateVoices;
    }
  }

  getVoices() {
    if (!this.hasTTS) return [];
    return this.synth.getVoices().filter(v => v.lang.startsWith('en'));
  }

  setVoice(voiceName) {
    const voices = this.synth.getVoices();
    const v = voices.find(x => x.name === voiceName);
    if (v) this.selectedVoice = v;
  }

  speak(text, onComplete) {
    if (!this.hasTTS || this.isMuted || !text) {
      if (onComplete) onComplete();
      return;
    }

    // Stop current speech & listening
    this.stopSpeaking();
    this.stopListening();

    // Clean markdown/special characters for natural speech
    const cleanText = text
      .replace(/\*+/g, '')
      .replace(/#+/g, '')
      .replace(/`+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (this.selectedVoice) utterance.voice = this.selectedVoice;
    utterance.rate = this.speechRate;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.onSpeakingChange) this.onSpeakingChange(true);
      this.startVisualizer('speaker');
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.onSpeakingChange) this.onSpeakingChange(false);
      this.stopVisualizer();
      if (onComplete) onComplete();
    };

    utterance.onerror = (e) => {
      console.warn("TTS Error:", e);
      this.isSpeaking = false;
      if (this.onSpeakingChange) this.onSpeakingChange(false);
      this.stopVisualizer();
      if (onComplete) onComplete();
    };

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.hasTTS && this.synth.speaking) {
      this.synth.cancel();
      this.isSpeaking = false;
      if (this.onSpeakingChange) this.onSpeakingChange(false);
      this.stopVisualizer();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopSpeaking();
    }
    return this.isMuted;
  }

  /* ------------------------------------------------------------
     3. ANIMATED AUDIO CANVAS VISUALIZER
     ------------------------------------------------------------ */
  setCanvas(canvasElement) {
    this.canvas = canvasElement;
    if (canvasElement) {
      this.ctx = canvasElement.getContext('2d');
    }
  }

  startVisualizer(mode) {
    if (!this.canvas || !this.ctx) return;
    this.stopVisualizer();

    let step = 0;
    const draw = () => {
      step += 0.08;
      const width = this.canvas.width;
      const height = this.canvas.height;
      this.ctx.clearRect(0, 0, width, height);

      const color = mode === 'mic' ? '#4FD1C5' : '#6366F1';
      const bars = 30;
      const barWidth = width / bars - 2;

      for (let i = 0; i < bars; i++) {
        // Generate simulated dynamic audio wave frequencies
        const sinVal = Math.sin(step + i * 0.3);
        const cosVal = Math.cos(step * 0.8 + i * 0.2);
        const barHeight = Math.max(4, Math.abs(sinVal * cosVal) * (height - 4));

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, barWidth, barHeight, 2);
        this.ctx.fill();
      }

      this.animFrameId = requestAnimationFrame(draw);
    };

    draw();
  }

  stopVisualizer() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /* ------------------------------------------------------------
     4. AUDIO CHIME SYNTHESIZER (WEB AUDIO API)
     ------------------------------------------------------------ */
  playChime(freq, duration) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context policy safe fallback
    }
  }
}

// Global Voice Instance
window.voiceEngine = new VoiceEngine();
