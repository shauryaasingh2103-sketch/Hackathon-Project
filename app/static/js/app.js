/* ============================================================
   AI INTERVIEW AGENT - MAIN APPLICATION CONTROLLER
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  // Session State
  let sessionId = null;
  let candidates = [];
  let selectedCandidate = null;
  let interviewDone = false;
  let turnTimerInterval = null;
  let remainingTime = 0;

  // DOM Element References
  const els = {
    candidateSelect: document.getElementById('candidateSelect'),
    difficultySelect: document.getElementById('difficultySelect'),
    timerSelect: document.getElementById('timerSelect'),
    candidateMeta: document.getElementById('candidateMeta'),
    startBtn: document.getElementById('startBtn'),
    restartBtn: document.getElementById('restartBtn'),
    chatScroll: document.getElementById('chatScroll'),
    emptyState: document.getElementById('emptyState'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    micBtn: document.getElementById('micBtn'),
    progressBlock: document.getElementById('progressBlock'),
    qCount: document.getElementById('qCount'),
    dayCount: document.getElementById('dayCount'),
    dayStrip: document.getElementById('dayStrip'),
    topbarTitle: document.getElementById('topbarTitle'),
    statusPill: document.getElementById('statusPill'),
    statusText: document.getElementById('statusText'),
    timerPill: document.getElementById('timerPill'),
    timerText: document.getElementById('timerText'),
    muteBtn: document.getElementById('muteBtn'),
    voiceSettingsToggle: document.getElementById('voiceSettingsToggle'),
    voiceSettingsBar: document.getElementById('voiceSettingsBar'),
    voiceSelect: document.getElementById('voiceSelect'),
    audioCanvas: document.getElementById('audioCanvas'),
    visualizerContainer: document.getElementById('visualizerContainer'),
    voiceStatusText: document.getElementById('voiceStatusText'),
  };

  // Helper UUID Generator
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /* ------------------------------------------------------------
     1. INITIALIZATION & CANDIDATES LOAD
     ------------------------------------------------------------ */
  async function initApp() {
    // Setup Voice Engine Canvas
    if (els.audioCanvas) {
      window.voiceEngine.setCanvas(els.audioCanvas);
    }

    // Voice Engine Callbacks
    window.voiceEngine.onTranscriptUpdate = (text, isFinal) => {
      els.messageInput.value = text;
      els.messageInput.style.height = 'auto';
      els.messageInput.style.height = Math.min(els.messageInput.scrollHeight, 160) + 'px';
      
      if (isFinal && window.voiceEngine.autoSend) {
        handleSendMessage();
      }
    };

    window.voiceEngine.onListeningChange = (isListening) => {
      if (isListening) {
        els.micBtn.classList.add('listening');
        els.micBtn.title = "Click to stop listening";
        els.visualizerContainer.style.display = 'flex';
        els.voiceStatusText.textContent = "Listening...";
      } else {
        els.micBtn.classList.remove('listening');
        els.micBtn.title = "Click to speak";
        els.visualizerContainer.style.display = 'none';
      }
    };

    window.voiceEngine.onSpeakingChange = (isSpeaking) => {
      if (isSpeaking) {
        els.visualizerContainer.style.display = 'flex';
        els.voiceStatusText.textContent = "AI Speaking...";
      } else {
        els.visualizerContainer.style.display = 'none';
      }
    };

    // Load candidates from server
    try {
      candidates = await window.InterviewAPI.fetchCandidates();
      els.candidateSelect.innerHTML = candidates.map(c =>
        `<option value="${c.id}">${c.name} — ${c.jobRole}</option>`
      ).join('');

      if (candidates.length) {
        els.candidateSelect.value = candidates[0].id;
        updateSelectedCandidate();
        els.startBtn.disabled = false;
      }
    } catch (e) {
      els.candidateSelect.innerHTML = `<option value="">Error loading candidates</option>`;
    }

    // Populate Voice Selection Dropdown
    populateVoiceSelect();
  }

  function updateSelectedCandidate() {
    selectedCandidate = candidates.find(c => c.id === els.candidateSelect.value);
    window.InterviewUI.renderCandidateMeta(els.candidateMeta, selectedCandidate);
  }

  function populateVoiceSelect() {
    const voices = window.voiceEngine.getVoices();
    if (!voices.length) return;
    els.voiceSelect.innerHTML = voices.map(v => 
      `<option value="${v.name}">${v.name} (${v.lang})</option>`
    ).join('');
    if (window.voiceEngine.selectedVoice) {
      els.voiceSelect.value = window.voiceEngine.selectedVoice.name;
    }
  }

  /* ------------------------------------------------------------
     2. TURN RESPONSE TIMER CONTROLLER
     ------------------------------------------------------------ */
  function startTurnTimer() {
    clearTurnTimer();
    const limit = parseInt(els.timerSelect.value, 10);
    if (!limit || limit <= 0) {
      els.timerPill.style.display = 'none';
      return;
    }

    remainingTime = limit;
    els.timerPill.style.display = 'inline-flex';
    updateTimerText();

    turnTimerInterval = setInterval(() => {
      remainingTime--;
      updateTimerText();

      if (remainingTime <= 0) {
        clearTurnTimer();
        // Time expired auto-submit
        if (!els.messageInput.value.trim()) {
          els.messageInput.value = "Candidate timed out before answering this question.";
        }
        handleSendMessage();
      }
    }, 1000);
  }

  function clearTurnTimer() {
    if (turnTimerInterval) {
      clearInterval(turnTimerInterval);
      turnTimerInterval = null;
    }
    els.timerPill.style.display = 'none';
  }

  function updateTimerText() {
    const mins = Math.floor(remainingTime / 60);
    const secs = remainingTime % 60;
    els.timerText.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  /* ------------------------------------------------------------
     3. INTERVIEW SESSION CONTROL
     ------------------------------------------------------------ */
  async function handleStartInterview() {
    const c = candidates.find(c => c.id === els.candidateSelect.value);
    if (!c) return;

    selectedCandidate = c;
    sessionId = uuid();
    interviewDone = false;

    // Play Sci-Fi Start Chime
    window.voiceEngine.playStartSFX();

    // UI Updates
    if (els.emptyState) els.emptyState.style.display = 'none';
    els.startBtn.disabled = true;
    els.candidateSelect.disabled = true;
    els.difficultySelect.disabled = true;
    els.progressBlock.style.display = 'flex';
    els.topbarTitle.textContent = `Interviewing ${c.name}`;
    window.InterviewUI.updateStatusBadge(els.statusPill, els.statusText, 'live', 'in progress');
    window.InterviewUI.showTypingIndicator(els.chatScroll);

    try {
      const difficulty = els.difficultySelect ? els.difficultySelect.value : "senior";
      const data = await window.InterviewAPI.postStartInterview(sessionId, c.raw, difficulty);
      window.InterviewUI.hideTypingIndicator();
      
      // Render reply and automatically read aloud via voice engine
      const msgElem = window.InterviewUI.appendMessage(els.chatScroll, 'interviewer', data.reply);
      window.voiceEngine.speak(data.reply);

      els.messageInput.disabled = false;
      els.sendBtn.disabled = false;
      els.micBtn.disabled = false;
      els.messageInput.focus();

      startTurnTimer();
      refreshInterviewStatus();
    } catch (e) {
      window.InterviewUI.hideTypingIndicator();
      window.InterviewUI.appendMessage(els.chatScroll, 'system', 'Could not reach the interview server. Please check backend connection.');
    }
  }

  async function handleSendMessage() {
    const text = els.messageInput.value.trim();
    if (!text || interviewDone) return;

    clearTurnTimer();
    window.voiceEngine.playSendSFX();

    // Stop active listening & speech synthesis
    window.voiceEngine.stopListening();
    window.voiceEngine.stopSpeaking();

    // Render candidate answer bubble
    window.InterviewUI.appendMessage(els.chatScroll, 'candidate', text);
    
    // Clear input box
    els.messageInput.value = '';
    els.messageInput.style.height = 'auto';
    els.messageInput.disabled = true;
    els.sendBtn.disabled = true;
    els.micBtn.disabled = true;

    window.InterviewUI.showTypingIndicator(els.chatScroll);

    try {
      const data = await window.InterviewAPI.postSendMessage(sessionId, text);
      window.InterviewUI.hideTypingIndicator();

      // Render response bubble
      window.InterviewUI.appendMessage(els.chatScroll, 'interviewer', data.reply);
      
      // Speak AI question
      window.voiceEngine.speak(data.reply);

      if (data.done) {
        interviewDone = true;
        clearTurnTimer();
        window.voiceEngine.playFanfareSFX();
        window.InterviewUI.updateStatusBadge(els.statusPill, els.statusText, 'done', 'complete');
        els.topbarTitle.textContent = `Interview complete — ${selectedCandidate.name}`;
        
        if (data.feedback) {
          window.InterviewUI.renderFeedbackReport(els.chatScroll, data.feedback);
        }

        els.messageInput.disabled = true;
        els.sendBtn.disabled = true;
        els.micBtn.disabled = true;
        els.restartBtn.style.display = 'block';
      } else {
        els.messageInput.disabled = false;
        els.sendBtn.disabled = false;
        els.micBtn.disabled = false;
        els.messageInput.focus();
        startTurnTimer();
      }

      refreshInterviewStatus();
    } catch (e) {
      window.InterviewUI.hideTypingIndicator();
      window.InterviewUI.appendMessage(els.chatScroll, 'system', 'Connection error — please try again.');
      els.messageInput.disabled = false;
      els.sendBtn.disabled = false;
      els.micBtn.disabled = false;
    }
  }

  async function refreshInterviewStatus() {
    if (!sessionId) return;
    const s = await window.InterviewAPI.fetchStatus(sessionId);
    if (!s) return;

    els.qCount.textContent = `${s.questionsAsked} / ${s.minQuestions}`;
    els.dayCount.textContent = `${s.daysCovered.length} / ${s.minDays}`;

    if (s.planDays && !document.getElementById(`day-${s.planDays[0]}`)) {
      window.InterviewUI.renderDayStrip(els.dayStrip, s.planDays);
    }

    document.querySelectorAll('.day-chip').forEach(chip => chip.classList.remove('current', 'covered'));
    
    s.daysCovered.forEach(d => {
      const chip = document.getElementById(`day-${d}`);
      if (chip) chip.classList.add('covered');
    });

    if (s.currentDay) {
      const chip = document.getElementById(`day-${s.currentDay}`);
      if (chip && !s.daysCovered.includes(s.currentDay)) chip.classList.add('current');
    }
  }

  function handleResetUI() {
    sessionId = null;
    interviewDone = false;
    clearTurnTimer();
    window.voiceEngine.stopSpeaking();
    window.voiceEngine.stopListening();

    els.chatScroll.innerHTML = '';
    els.progressBlock.style.display = 'none';
    els.candidateSelect.disabled = false;
    els.difficultySelect.disabled = false;
    els.startBtn.disabled = false;
    els.restartBtn.style.display = 'none';
    els.topbarTitle.textContent = 'No interview in progress';
    window.InterviewUI.updateStatusBadge(els.statusPill, els.statusText, '', 'idle');
    
    els.messageInput.value = '';
    els.messageInput.disabled = true;
    els.sendBtn.disabled = true;
    els.micBtn.disabled = true;

    if (els.emptyState) {
      els.emptyState.style.display = 'block';
      els.chatScroll.appendChild(els.emptyState);
    }
  }

  /* ------------------------------------------------------------
     4. REPLAY QUESTION VOICE FUNCTION
     ------------------------------------------------------------ */
  window.handleReplayTTS = function(btnElem) {
    const msgDiv = btnElem.closest('.msg');
    if (!msgDiv || !msgDiv.dataset.rawText) return;
    
    btnElem.classList.add('speaking');
    window.voiceEngine.speak(msgDiv.dataset.rawText, () => {
      btnElem.classList.remove('speaking');
    });
  };

  /* ------------------------------------------------------------
     5. EVENT LISTENERS
     ------------------------------------------------------------ */
  els.candidateSelect.addEventListener('change', updateSelectedCandidate);
  els.startBtn.addEventListener('click', handleStartInterview);
  els.restartBtn.addEventListener('click', handleResetUI);
  els.sendBtn.addEventListener('click', handleSendMessage);

  // Microphone toggle button
  els.micBtn.addEventListener('click', () => {
    window.voiceEngine.toggleListening();
  });

  // Mute toggle button
  els.muteBtn.addEventListener('click', () => {
    const muted = window.voiceEngine.toggleMute();
    els.muteBtn.classList.toggle('active', muted);
    els.muteBtn.title = muted ? "Unmute AI Voice" : "Mute AI Voice";
  });

  // Voice Settings drawer toggle
  els.voiceSettingsToggle.addEventListener('click', () => {
    populateVoiceSelect();
    els.voiceSettingsBar.classList.toggle('open');
  });

  // Voice selection change
  els.voiceSelect.addEventListener('change', (e) => {
    window.voiceEngine.setVoice(e.target.value);
  });

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  els.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Dynamic textarea height resizing
  els.messageInput.addEventListener('input', () => {
    els.messageInput.style.height = 'auto';
    els.messageInput.style.height = Math.min(els.messageInput.scrollHeight, 160) + 'px';
  });

  // Initialize App
  initApp();
});
