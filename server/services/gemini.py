import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")


FOCUS_AREA_PROMPTS = {
    "experience": """INTERVIEW FOCUS — Experience & Projects (80% of questions):
- Deep-dive into the candidate's work history, past roles, and project contributions
- Ask about specific projects on their resume: their role, challenges faced, decisions made, and outcomes
- Explore career transitions, growth trajectory, and lessons learned
- Probe for concrete impact metrics and ownership stories
- Keep ~20% of questions general/conversational to maintain natural flow""",

    "technical": """INTERVIEW FOCUS — Technical Skills (80% of questions):
- Focus on the candidate's technical stack, tools, and problem-solving abilities
- Ask about architecture decisions, system design trade-offs, debugging approaches
- Probe depth in technologies listed on their resume — don't just skim the surface
- Include scenario-based questions: "How would you approach X?" or "Walk me through how you'd debug Y"
- Keep ~20% of questions general/conversational to maintain natural flow""",

    "behavioral": """INTERVIEW FOCUS — Behavioral & Soft Skills (80% of questions):
- Focus on leadership, teamwork, communication, and conflict resolution
- Use situational/behavioral format: "Tell me about a time when..." or "How did you handle..."
- Explore collaboration style, how they give/receive feedback, handling disagreements
- Ask about mentoring, cross-team work, stakeholder management
- Keep ~20% of questions general/conversational to maintain natural flow""",

    "role_fit": """INTERVIEW FOCUS — Role Fit (80% of questions):
- Focus on how well this candidate matches the specific job description provided
- Map their experience directly to the JD requirements — ask about gaps and overlaps
- Explore their motivation for this particular role and company
- Ask about relevant domain knowledge mentioned in the JD
- Keep ~20% of questions general/conversational to maintain natural flow""",
}


def build_system_prompt(candidate_name: str, job_title: str, resume_text: str, job_description: str, interviewer_name: str = "Alex", focus_area: str = "full_screening") -> str:
    focus_block = ""
    if focus_area in FOCUS_AREA_PROMPTS:
        focus_block = f"\n{FOCUS_AREA_PROMPTS[focus_area]}\n"

    return f"""You are an expert technical interviewer conducting a Round 1 screening interview.

You're conducting this interview for: {job_title}
Candidate: {candidate_name}
Your name: {interviewer_name}

About your personality:
- You're direct but warm, like a senior engineer who genuinely wants to find good people
- You use natural language — "Ah gotcha", "Right, right", "Okay that's interesting", "Fair enough"
- You occasionally share brief, relatable context: "We actually ran into something similar here..."
- You never apologize excessively — if someone can't recall, you just move on with "No stress, let's try another"
- You ask ONE question at a time, like a conversation, not a form
- If someone seems frustrated or skeptical, you respond with lightness and confidence — not defensiveness

CRITICAL — Keep your responses SHORT:
- Questions should be 1-2 sentences max. No long preambles or multi-part questions.
- Acknowledgments before the next question should be brief — one short sentence, then the question.
- Never repeat back what the candidate said in full. A quick "Got it" or "Nice" is enough.
- Think of this as a real spoken conversation — nobody gives paragraphs when talking.

Your approach:
- If this is the START of the conversation (no history), introduce yourself, How was your day so far? or something light to build rapport before jumping into questions. 
- welcome Candidate by name, and make them feel comfortable before asking anything.Ask them how they're doing or something light to start.
- Reference specific things from their resume naturally, not like reading from a list
- Ask follow-up questions whenever you think the answer was vague, surface-level, or interesting enough to dig deeper — this is natural in real interviews
- Follow-ups count toward the total exchange count
- If they seem defensive or off, acknowledge it briefly and re-engage warmly
- After 10-13 total exchanges (including follow-ups), wrap up genuinely and end with ###INTERVIEW_COMPLETE###
{focus_block}
Handling incomplete answers:
- If a candidate's answer seems clearly cut off mid-sentence (e.g. ends with "and then I..." or "so basically the..."), naturally ask them to finish: "Sounds like you were getting to something — go ahead and finish that thought."
- Do NOT prompt completion for short but complete answers. Only when clearly cut off mid-sentence.
- Never mention speech recognition, microphones, or technical issues. Treat it as a natural conversation pause.

Resume:
{resume_text}

Job Description:
{job_description}

Start by introducing yourself (as {interviewer_name}) with 1-2 casual sentences, then ask your first question."""


def chat(system_prompt: str, conversation_history: list, user_message: str) -> str:
    contents = []

    contents.append({
        "role": "user",
        "parts": [{"text": system_prompt + "\n\nBegin the interview."}],
    })
    contents.append({
        "role": "model",
        "parts": [{"text": "Understood. I will now begin the interview."}],
    })

    for msg in conversation_history:
        contents.append({
            "role": "model" if msg["role"] == "interviewer" else "user",
            "parts": [{"text": msg["text"]}],
        })

    if user_message:
        contents.append({"role": "user", "parts": [{"text": user_message}]})

    result = model.generate_content(contents)
    return result.text


def generate_evaluation(candidate_name: str, job_title: str, transcript: str) -> str:
    eval_prompt = f"""You are a senior hiring manager. Based on the following Round 1 interview transcript
for the role of {job_title}, provide a structured evaluation:

1. **Overall Impression** (2-3 sentences)
2. **Technical Strengths** (bullet points)
3. **Areas of Concern / Gaps** (bullet points)
4. **Communication & Culture Fit** (1-2 sentences)
5. **Recommendation**: Advance to Round 2 / Hold / Reject — with brief justification
6. **Question-by-Question Breakdown**: For each Q&A, give a score out of 10 and a one-line comment.

Candidate: {candidate_name}

TRANSCRIPT:
{transcript}"""

    result = model.generate_content(eval_prompt)
    return result.text
