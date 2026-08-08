/* ============================================================
   AI INTERVIEW AGENT - UI RENDERING MODULE
   ============================================================ */

/**
 * HTML Escaper for security
 */
function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.innerText = str;
  return d.innerHTML;
}

/**
 * Scroll chat area to bottom
 */
function scrollToBottom(chatElem) {
  if (!chatElem) return;
  chatElem.scrollTop = chatElem.scrollHeight;
}

/**
 * Render candidate meta information card
 */
function renderCandidateMeta(metaElem, candidate) {
  if (!metaElem) return;
  if (!candidate) {
    metaElem.innerHTML = '';
    return;
  }
  metaElem.innerHTML = `
    <div class="candidate-card">
      <strong>${escapeHtml(candidate.name)}</strong> (${candidate.yearsExperience} yrs exp)<br/>
      <span style="color: var(--text-muted); font-size:12px;">${escapeHtml(candidate.education)}</span>
    </div>
  `;
}

/**
 * Append chat message bubble to container
 */
function appendMessage(chatElem, role, text, messageId) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (messageId) div.id = messageId;

  const isInterviewer = role === 'interviewer';
  const isCandidate = role === 'candidate';
  const tagText = isInterviewer ? 'AI Interviewer' : isCandidate ? 'Candidate (You)' : '';

  let headerHtml = '';
  if (tagText) {
    headerHtml = `
      <div class="msg-header">
        <span class="msg-tag">${tagText}</span>
        ${isInterviewer ? `
          <button class="tts-play-btn" title="Listen to question" onclick="window.handleReplayTTS(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
          </button>
        ` : ''}
      </div>
    `;
  }

  // Store raw text dataset for TTS playback
  div.dataset.rawText = text;
  div.innerHTML = headerHtml + `<div>${escapeHtml(text)}</div>`;

  chatElem.appendChild(div);
  scrollToBottom(chatElem);
  return div;
}

/**
 * Show animated typing indicator
 */
function showTypingIndicator(chatElem) {
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.id = 'typingIndicator';
  div.innerHTML = '<span></span><span></span><span></span>';
  chatElem.appendChild(div);
  scrollToBottom(chatElem);
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
  const elem = document.getElementById('typingIndicator');
  if (elem) elem.remove();
}

/**
 * Set topbar status badge mode
 */
function updateStatusBadge(pillElem, textElem, mode, text) {
  if (!pillElem || !textElem) return;
  pillElem.className = `status-pill ${mode}`;
  textElem.textContent = text;
}

/**
 * Initialize Day Strip chips
 */
function renderDayStrip(stripElem, planDays) {
  if (!stripElem || !planDays) return;
  stripElem.innerHTML = '';
  planDays.forEach(d => {
    const chip = document.createElement('div');
    chip.className = 'day-chip';
    chip.id = `day-${d}`;
    chip.textContent = d;
    stripElem.appendChild(chip);
  });
}

/**
 * Render structured final feedback report card
 */
function renderFeedbackReport(chatElem, fb) {
  if (!chatElem || !fb) return;

  const div = document.createElement('div');
  div.className = 'report';
  div.innerHTML = `
    <h3>Interview Performance Evaluation</h3>
    <p class="summary">${escapeHtml(fb.summary)}</p>
    <div class="report-grid">
      <div class="report-section strengths">
        <h4>Strengths Identified</h4>
        <ul>${fb.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
      </div>
      <div class="report-section gaps">
        <h4>Areas for Growth</h4>
        <ul>${fb.gaps.map(g => `<li>${escapeHtml(g)}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="report-section next">
      <h4>Recommended Next Steps</h4>
      <ul>${fb.next.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
    </div>
  `;

  chatElem.appendChild(div);
  scrollToBottom(chatElem);
}

// Export UI handlers
window.InterviewUI = {
  escapeHtml,
  scrollToBottom,
  renderCandidateMeta,
  appendMessage,
  showTypingIndicator,
  hideTypingIndicator,
  updateStatusBadge,
  renderDayStrip,
  renderFeedbackReport
};
