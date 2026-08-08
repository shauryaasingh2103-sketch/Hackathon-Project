# Prompts Log — AI Interview Agent

This is the chronological log of prompts used to build this project with
an AI coding assistant, from initial scoping through UI polish.

---

### Prompt 1 — Scoping the build

Shared the full hackathon problem statement (the "AI Interview Agent"
brief — objectives, provided resources, minimum requirements, and
out-of-scope items) and asked:

> "Tell me how to build this kind of AI Interviewer."

**Goal:** Turn the challenge brief into a concrete build plan before
writing any code.

---

### Prompt 2 — Requesting a deployable interface

> "I need a deployable website where the AI interview can actually run.
> I don't know much about this yet, so please build the interface for
> it."

**Goal:** Get a working, hostable chat interface, not just backend code —
acknowledged upfront as a beginner in web deployment.

---

### Prompt 3 — Debugging the LLM provider

> "This is the code I was given, but it gets stuck whenever I try to use
> the Anthropic API key, because of billing/credit issues. I recall being
> told the plan was to switch `llm.py` over to Gemini since it's free.
> What should I do next? I'm a complete beginner and want to get this
> running now."

**Goal:** Unblock a billing issue by migrating the LLM backend from
Anthropic to Gemini.

---

### Prompt 4 — Confirming the fix

> "Gemini is working now — what are the next steps?"

**Goal:** Continue setup once the provider switch was confirmed working.

---

### Prompt 5 — Confirming local run

> "It's running in the browser now — what should I do next?"

**Goal:** Move from "server starts" to "interview actually works
end-to-end."

---

### Prompt 6 — Iterating on interview flow

Shared the app's first response after starting an interview and asked
for the appropriate follow-up handling for that step.

**Goal:** Refine how the agent should react to a candidate's opening
answer.

---

### Prompt 7 — Feature request: voice + UI polish

> "Here's the project as it stands. I want to add a voice-enabled chat
> interface to the interview agent, and make the UI more modular and
> visually polished."

**Goal:** Extend beyond the minimum requirements with a voice interaction
layer and a more refined, componentized frontend.

---

### Prompt 8 — Requirements check

Re-shared the full hackathon problem statement and asked directly:

> "Does this project satisfy the requirements of the problem statement?"

**Goal:** Validate the build against the brief's minimum requirements
(≥8 questions, ≥4 distinct curriculum days, follow-ups, context
retention, structured feedback, the required endpoint) before treating
the core build as done.

---

### Prompt 9 — Visual theme

> "Update the chat background to a futuristic, animated theme."

**Goal:** Give the interface a distinct visual identity beyond default
styling.

---

### Prompt 10 — Open-ended next steps

> "What else can be done with this now?"

**Goal:** Surface further improvement ideas once the core build and
styling were in place.

---


