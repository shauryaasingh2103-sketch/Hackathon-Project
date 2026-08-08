/* ============================================================
   AI INTERVIEW AGENT - API SERVICE LAYER
   ============================================================ */

const API_BASE = ""; // relative path for same-origin server

/**
 * Fetch candidates list from backend
 */
async function fetchCandidates() {
  const res = await fetch(`${API_BASE}/api/candidates`);
  if (!res.ok) throw new Error(`Failed to fetch candidates (${res.status})`);
  return await res.json();
}

/**
 * Start a new interview session
 * @param {string} sessionId 
 * @param {object} candidatePayload 
 */
async function postStartInterview(sessionId, candidatePayload, difficulty = "senior") {
  const res = await fetch(`${API_BASE}/api/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, candidate: candidatePayload, difficulty })
  });
  if (!res.ok) throw new Error(`Start interview error (${res.status})`);
  return await res.json();
}

/**
 * Send candidate answer message to interview session
 * @param {string} sessionId 
 * @param {string} messageText 
 */
async function postSendMessage(sessionId, messageText) {
  const res = await fetch(`${API_BASE}/api/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message: messageText })
  });
  if (!res.ok) throw new Error(`Send message error (${res.status})`);
  return await res.json();
}

/**
 * Fetch live progress status for session tracker
 * @param {string} sessionId 
 */
async function fetchStatus(sessionId) {
  const res = await fetch(`${API_BASE}/api/interview/${sessionId}/status`);
  if (!res.ok) return null;
  return await res.json();
}

// Export functions to global scope for modular access
window.InterviewAPI = {
  fetchCandidates,
  postStartInterview,
  postSendMessage,
  fetchStatus
};
