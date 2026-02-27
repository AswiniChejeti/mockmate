"""
app/services/ai_service.py
───────────────────────────
Central service that handles ALL LLM API calls.

Supports both OpenAI GPT and Google Gemini — configured via .env AI_PROVIDER.

Every function here returns structured Python objects that the API routes
can directly use. If the LLM is unavailable, fallback mock data is returned
so the app doesn't crash during development.
"""

import json
import re
from app.core.config import settings


# ─── LLM Client Setup ─────────────────────────────────────────────────────────

def _call_llm(prompt: str) -> str:
    """
    Internal helper: sends a prompt to the configured AI provider
    and returns the raw text response.
    """
    provider = settings.AI_PROVIDER.lower()

    if provider == "openai":
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()

    elif provider == "gemini":
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        # Confirmed working models (verified via test_ai.py against this API key)
        # gemini-2.0-flash / gemini-2.5-flash are quota-exhausted on the free tier
        gemini_models = [
            "gemini-flash-latest",            # works, good quota
            "gemini-flash-lite-latest",        # works, highest quota
            "gemini-2.5-flash-lite",           # works, fallback
            "gemini-2.0-flash",               # try anyway in case quota resets
        ]
        last_error = None
        for model_name in gemini_models:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                print(f"[AI] Used model: {model_name}")
                return response.text.strip()
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    print(f"[AI] {model_name} quota exhausted, trying next model...")
                else:
                    print(f"[AI] {model_name} failed ({type(e).__name__}): {err_str[:100]} -- trying next model...")
                last_error = e
                continue
        # All models failed
        print(f"[AI] All Gemini models failed. Last error: {last_error}")
        raise last_error




    else:
        raise ValueError(f"Unknown AI_PROVIDER: '{provider}'. Set 'openai' or 'gemini' in .env")


def _parse_json_from_response(text: str) -> any:
    """
    Extracts and parses JSON from an LLM response.
    Tries multiple strategies because LLMs often wrap JSON in markdown
    code blocks, add explanatory text before/after, or mix formats.
    """
    if not text:
        raise ValueError("Empty LLM response")

    # Strategy 1: strip ALL markdown fences and try direct parse
    clean = re.sub(r"```(?:json|python)?\s*", "", text).replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # Strategy 2: find the first JSON object { ... }
    match = re.search(r'\{.*\}', clean, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    # Strategy 3: find the first JSON array [ ... ]
    match = re.search(r'\[.*\]', clean, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    # Strategy 4: last resort — try raw text as-is
    return json.loads(text)


# ─── Public AI Functions ──────────────────────────────────────────────────────

def extract_resume_data(resume_text: str) -> dict:
    """
    Asks the LLM to extract technical skills, experience, and education from resume text.

    Returns:
        A dict: {"skills": [...], "experience": [...], "education": [...]}
    """
    prompt = f"""
You are an expert HR recruiter and technical analyst.

Extract the following from the resume text:
1. "skills": technical skills, programming languages, frameworks, tools, soft skills
2. "experience": job titles, companies, and concise descriptions of experience
3. "education": degrees, universities, graduation years

Return ONLY a valid JSON object with these EXACT three keys containing arrays of strings. No explanation, no markdown.
Example format:
{{
  "skills": ["Python", "FastAPI", "MySQL"],
  "experience": ["Software Engineer at Acme Corp (2020-2023): Built API...", "Intern at Beta Inc"],
  "education": ["B.S. Computer Science, XYZ University, 2022"]
}}

Resume Text:
\"\"\"
{resume_text[:4000]}
\"\"\"
"""
    try:
        raw = _call_llm(prompt)
        data = _parse_json_from_response(raw)
        if isinstance(data, dict):
            return {
                "skills": data.get("skills", []),
                "experience": data.get("experience", []),
                "education": data.get("education", [])
            }
        return {"skills": [], "experience": [], "education": []}
    except Exception as e:
        print(f"[AI] extract_resume_data error: {e}")
        return {"skills": ["Python", "Communication"], "experience": [], "education": []}


def generate_mcqs(skill: str, num_questions: int = 10, level: str = "Medium") -> list[dict]:
    """
    Generates multiple-choice questions (MCQs) for a given skill and difficulty level.

    Returns:
        List of dicts with keys: question, options, correct_answer, explanation, average_time
    """
    prompt = f"""
You are an expert technical interviewer.

Generate exactly {num_questions} multiple-choice questions to test a candidate's knowledge of "{skill}".
Difficulty level: {level}
- Easy: Basic definitions and simple concepts
- Medium: Applied knowledge and common patterns
- Hard: Advanced concepts, edge cases, optimizations

Each question must have exactly 4 options (A, B, C, D), one correct answer, a brief explanation,
and an `average_time` in seconds a candidate would need to answer it (typically 30-90 seconds).

Return ONLY valid JSON — a list of exactly {num_questions} objects with this exact structure:
[
  {{
    "question": "What does X do?",
    "options": [
      {{"key": "A", "value": "Option 1"}},
      {{"key": "B", "value": "Option 2"}},
      {{"key": "C", "value": "Option 3"}},
      {{"key": "D", "value": "Option 4"}}
    ],
    "correct_answer": "A",
    "explanation": "Because X works by...",
    "average_time": 45
  }}
]

Skill: {skill}
Difficulty: {level}
Number of questions: {num_questions}
"""
    try:
        raw = _call_llm(prompt)
        print(f"[AI] generate_mcqs raw response (first 500 chars): {raw[:500]}")
        questions = _parse_json_from_response(raw)
        if isinstance(questions, list) and len(questions) > 0:
            return questions[:num_questions]
        print(f"[AI] generate_mcqs: parsed result is not a valid list, got: {type(questions)}")
        return []
    except Exception as e:
        print(f"[AI] generate_mcqs error: {e}")
        fallback_questions = [
            {
                "question": f"[Fallback Q{i+1}] What is a key concept in {skill}?",
                "options": [
                    {"key": "A", "value": f"Core feature of {skill}"},
                    {"key": "B", "value": "Unrelated concept"},
                    {"key": "C", "value": "Another irrelevant option"},
                    {"key": "D", "value": "None of the above"},
                ],
                "correct_answer": "A",
                "explanation": f"Understanding core features of {skill} is fundamental.",
                "average_time": 45,
            }
            for i in range(num_questions)
        ]
        return fallback_questions


def generate_interview_questions(
    resume_text: str,
    num_questions: int = 5,
    level: str = "Medium",
    skills: list = None
) -> list[dict]:
    """
    Generates tailored mock interview questions based on the resume content.

    Returns:
        A list of dicts: [{"question": str, "average_time": int (seconds)}, ...]
    """
    # num_questions and skills are BOTH strictly enforced in the prompt AND by slicing
    skill_restriction = ""
    resume_section = ""

    if skills:
        skill_list = ", ".join(skills)
        n = len(skills)
        # When skills are explicitly selected, do NOT include resume text at all.
        # The resume causes the LLM to drift toward all resume skills.
        # Instead, just tell it which skills to focus on.
        skill_restriction = f"""
FOCUS SKILLS: {skill_list}

You must generate questions ONLY about the above {n} skill(s).
Do NOT ask about any other technology even if you know the candidate might know it.
Every question must directly test one of: {skill_list}
"""
    else:
        # No skill filter: use resume for context
        resume_section = f"""
Candidate Resume (use this to personalize questions):
\"\"\"
{resume_text[:3000]}
\"\"\"
"""

    prompt = f"""
You are a senior technical interviewer.

Generate EXACTLY {num_questions} interview question(s) at {level} difficulty.
IMPORTANT: Do NOT generate more or fewer than {num_questions} question(s).
{skill_restriction}
For each question ALSO decide:
- `answer_type`: either "voice" or "code"
  - Use "voice" for conceptual/theory/explanation questions (candidate will speak the answer)
  - Use "code" for questions that require writing actual code, SQL queries, algorithms, or pseudocode
- `code_language`: only when answer_type is "code" — set to one of: "python", "sql", "java", "javascript", "cpp", "generic"
  Leave as "" if answer_type is "voice"
- `average_time`: estimated seconds a good candidate needs (60-180)

Return ONLY a valid JSON array of EXACTLY {num_questions} item(s). No extra text, no markdown.
Format:
[
  {{"question": "...", "answer_type": "voice", "code_language": "", "average_time": 90}},
  {{"question": "Write a SQL query to...", "answer_type": "code", "code_language": "sql", "average_time": 120}}
]
{resume_section}"""

    try:
        raw = _call_llm(prompt)
        questions = _parse_json_from_response(raw)
        if isinstance(questions, list):
            result = []
            for q in questions:
                if isinstance(q, str):
                    result.append({"question": q, "average_time": 90, "answer_type": "voice", "code_language": ""})
                elif isinstance(q, dict):
                    result.append({
                        "question": q.get("question", str(q)),
                        "average_time": int(q.get("average_time", 90)),
                        "answer_type": q.get("answer_type", "voice"),
                        "code_language": q.get("code_language", ""),
                    })
            # Hard-truncate regardless of what LLM returned
            return result[:num_questions]
        return []
    except Exception as e:
        print(f"[AI] generate_interview_questions error: {e}")
        skill_name = skills[0] if skills else "technical"
        fallbacks = [
            {"question": f"Explain a real project where you applied {skill_name} and what challenges you faced.", "average_time": 120, "answer_type": "voice", "code_language": ""},
            {"question": f"What are the key concepts of {skill_name} you use most often and why?", "average_time": 90, "answer_type": "voice", "code_language": ""},
            {"question": f"How do you debug issues related to {skill_name} in production?", "average_time": 90, "answer_type": "voice", "code_language": ""},
            {"question": f"Describe a time you optimized code using {skill_name}.", "average_time": 120, "answer_type": "voice", "code_language": ""},
            {"question": f"How would you explain {skill_name} to a junior developer?", "average_time": 90, "answer_type": "voice", "code_language": ""},
        ]
        return fallbacks[:num_questions]


def evaluate_interview_answer(question: str, answer: str) -> dict:
    """
    Evaluates a candidate's answer to an interview question using AI.
    Returns: dict with keys: feedback (str), score (float 0-10)
    Empty/blank answers are returned immediately with score=0 without calling the AI.
    """
    # No answer given — skip AI call, return 0 immediately
    if not answer or not answer.strip():
        return {
            "feedback": "No answer was provided for this question. In an interview, skipping a question results in a score of 0.",
            "score": 0.0,
        }

    prompt = f"""
You are a senior technical interviewer evaluating a candidate's spoken answer.

Question: {question}

Candidate's Answer: {answer}

Evaluate the answer on:
1. Technical accuracy
2. Clarity and structure
3. Depth of understanding
4. Real-world applicability

Return ONLY valid JSON. No extra text before or after. No markdown fences.
{{
  "feedback": "Your detailed feedback here...",
  "score": 7.5
}}

The score must be a number between 0 and 10.
If the answer is completely irrelevant or nonsensical, score it 0.
Do not give a score of 5 as a default — base it strictly on the quality of the answer.
"""
    raw = None
    try:
        raw = _call_llm(prompt)
        print(f"[AI] evaluate raw response (first 300 chars): {raw[:300]}")
        result = _parse_json_from_response(raw)
        if isinstance(result, dict) and "feedback" in result and "score" in result:
            return {
                "feedback": str(result["feedback"]),
                "score": max(0.0, min(10.0, float(result.get("score", 0.0)))),
            }
        print(f"[AI] evaluate: unexpected result structure: {result}")
        return {"feedback": "Could not evaluate this answer at this time.", "score": 0.0}
    except Exception as e:
        print(f"[AI] evaluate_interview_answer error: {type(e).__name__}: {e}")
        if raw:
            print(f"[AI] raw response that caused error: {raw[:500]}")
        return {"feedback": f"Evaluation service temporarily unavailable ({type(e).__name__}). Score set to 0.", "score": 0.0}
