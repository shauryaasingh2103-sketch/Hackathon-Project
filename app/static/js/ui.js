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

  const chartId = 'radarChart_' + Date.now();

  const div = document.createElement('div');
  div.className = 'report';
  div.innerHTML = `
    <div style="display:flex; justify-size:space-between; align-items:center; margin-bottom:12px;">
      <h3>Interview Performance Evaluation</h3>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost" style="padding:6px 12px; font-size:12px; width:auto;" onclick="window.exportMarkdownReport()">📥 Download MD</button>
        <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; width:auto;" onclick="window.printPDFReport()">🖨️ Print PDF</button>
      </div>
    </div>
    <p class="summary">${escapeHtml(fb.summary)}</p>

    <!-- Radar Skill Chart Canvas -->
    <div style="background:rgba(18,25,38,0.7); border:1px solid var(--panel-border); border-radius:var(--radius-md); padding:16px; margin-bottom:20px;">
      <h4 style="font-family:var(--font-mono); font-size:11px; text-transform:uppercase; color:var(--accent-cyan); margin-bottom:12px;">Technical Skills Mastery Spectrum</h4>
      <div style="height:220px; position:relative;">
        <canvas id="${chartId}"></canvas>
      </div>
    </div>

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

  // Store report dataset globally for exporters
  window.lastFeedbackReport = fb;

  // Initialize Chart.js Radar Chart
  setTimeout(() => {
    const canvas = document.getElementById(chartId);
    if (canvas && window.Chart) {
      new window.Chart(canvas, {
        type: 'radar',
        data: {
          labels: ['RAG Architecture', 'Vector Indexing', 'Prompting', 'Agent Logic', 'AI Deployment'],
          datasets: [{
            label: 'Candidate Mastery Score',
            data: [85, 90, 78, 88, 92],
            backgroundColor: 'rgba(79, 209, 197, 0.25)',
            borderColor: '#4FD1C5',
            pointBackgroundColor: '#4FD1C5',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#4FD1C5'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              angleLines: { color: 'rgba(255,255,255,0.1)' },
              grid: { color: 'rgba(255,255,255,0.1)' },
              pointLabels: { color: '#94A3B8', font: { family: 'IBM Plex Mono', size: 10 } },
              ticks: { display: false },
              suggestedMin: 0,
              suggestedMax: 100
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }, 100);
}

// Global Exporter Functions
window.exportMarkdownReport = function() {
  const fb = window.lastFeedbackReport;
  if (!fb) return;
  const content = `# AI Technical Interview Report\n\n## Summary\n${fb.summary}\n\n## Strengths\n${fb.strengths.map(s => `- ${s}`).join('\n')}\n\n## Areas for Growth\n${fb.gaps.map(g => `- ${g}`).join('\n')}\n\n## Next Steps\n${fb.next.map(n => `- ${n}`).join('\n')}\n`;
  const blob = new Blob([content], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Interview_Evaluation_Report.md';
  a.click();
};

window.printPDFReport = function() {
  window.print();
};

/**
 * Render Quick Candidate Selector Cards in launchpad
 */
function renderQuickCandidateCards(containerElem, candidates, selectedId, onSelectCallback) {
  if (!containerElem || !candidates) return;
  containerElem.innerHTML = '';

  const displayList = candidates.slice(0, 6);
  displayList.forEach(c => {
    const card = document.createElement('div');
    card.className = `quick-candidate-card ${c.id === selectedId ? 'active' : ''}`;
    card.innerHTML = `
      <h4>${escapeHtml(c.name)}</h4>
      <p>${escapeHtml(c.jobRole || 'AI Engineer')}<br/>
      <span style="color:var(--accent-cyan); font-size:11px;">${c.yearsExperience ? c.yearsExperience + ' yrs exp' : 'Candidate Profile'}</span></p>
    `;
    card.addEventListener('click', () => {
      if (onSelectCallback) onSelectCallback(c.id);
    });
    containerElem.appendChild(card);
  });
}

/**
 * Introduction Overlay Modal Controls
 */
function openIntroModal() {
  const modal = document.getElementById('introModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeIntroModal() {
  const modal = document.getElementById('introModal');
  if (modal) {
    modal.style.display = 'none';
  }
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
  renderFeedbackReport,
  renderQuickCandidateCards,
  openIntroModal,
  closeIntroModal
};

