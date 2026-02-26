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
        # Try models in order — fall through if one is quota-exhausted
        gemini_models = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ]
        last_error = None
        for model_name in gemini_models:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                print(f"[AI] Using model: {model_name}")
                return response.text.strip()
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    print(f"[AI] {model_name} quota exhausted, trying next model...")
                    last_error = e
                    continue
                else:
                    raise  # Re-raise non-quota errors immediately
        # All models exhausted
        raise last_error

    else:
        raise ValueError(f"Unknown AI_PROVIDER: '{provider}'. Set 'openai' or 'gemini' in .env")


def _parse_json_from_response(text: str) -> any:
    """
    Extracts and parses JSON from an LLM response.
    LLMs sometimes wrap JSON in markdown code blocks (```json ... ```)
    so we strip those before parsing.
    """
    # Remove markdown code fences if present
    text = re.sub(r"```(?:json)?", "", text).strip().rstrip("```").strip()
    return json.loads(text)


# ─── Public AI Functions ──────────────────────────────────────────────────────

def extract_skills(resume_text: str) -> list[str]:
    """
    Asks the LLM to extract technical and soft skills from resume text.

    Returns:
        A list of skill strings, e.g. ["Python", "FastAPI", "MySQL", "Communication"]
    """
    prompt = f"""
You are an expert HR recruiter and technical analyst.

Extract all technical skills, programming languages, frameworks, tools,
soft skills, and domain knowledge from the following resume text.

Return ONLY a valid JSON array of strings. No explanation, no markdown.
Example: ["Python", "FastAPI", "MySQL", "Machine Learning", "Communication"]

Resume Text:
\"\"\"
{resume_text[:4000]}
\"\"\"
"""
    try:
        raw = _call_llm(prompt)
        skills = _parse_json_from_response(raw)
        if isinstance(skills, list):
            return skills
        return []
    except Exception as e:
        print(f"[AI] extract_skills error: {e}")
        return ["Python", "Communication", "Problem Solving"]  # fallback


def generate_mcqs(skill: str, num_questions: int = 10, level: str = "Medium") -> list[dict]:
    """
    Generates multiple-choice questions (MCQs) for a given skill and difficulty level.

    Args:
        skill: The topic/skill to generate questions about (e.g. "Python")
        num_questions: How many questions to generate
        level: Difficulty level — "Easy", "Medium", or "Hard"

    Returns:
        List of dicts with keys: question, options (list of {key, value}),
        correct_answer, explanation
    """
    prompt = f"""
You are an expert technical interviewer.

Generate exactly {num_questions} multiple-choice questions to test a candidate's knowledge of "{skill}".
Difficulty level: {level}
- Easy: Basic definitions and simple concepts
- Medium: Applied knowledge and common patterns
- Hard: Advanced concepts, edge cases, optimizations

Each question must have exactly 4 options (A, B, C, D), one correct answer, and a brief explanation.

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
    "explanation": "Because X works by..."
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
        # Return fallback questions matching the requested count so the app doesn't crash
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
            }
            for i in range(num_questions)
        ]
        return fallback_questions


def generate_interview_questions(resume_text: str, num_questions: int = 7) -> list[str]:
    """
    Generates tailored mock interview questions based on the resume content.

    Returns:
        A list of question strings.
    """
    prompt = f"""
You are a senior technical interviewer conducting a mock interview.

Based on the candidate's resume below, generate {num_questions} insightful,
personalized interview questions that:
1. Test their technical skills mentioned in the resume
2. Ask about specific projects or experiences
3. Include at least 1 behavioral question (e.g., "Tell me about a challenge...")
4. Are open-ended (not yes/no questions)

Return ONLY a valid JSON array of question strings. No numbering, no markdown.
Example: ["Tell me about your experience with FastAPI.", "How did you handle ..."]

Resume:
\"\"\"
{resume_text[:4000]}
\"\"\"
"""
    try:
        raw = _call_llm(prompt)
        questions = _parse_json_from_response(raw)
        if isinstance(questions, list):
            return questions[:num_questions]
        return []
    except Exception as e:
        print(f"[AI] generate_interview_questions error: {e}")
        return [
            "Tell me about yourself and your technical background.",
            "What is your most challenging project? How did you overcome obstacles?",
            "Explain a complex technical concept you have worked with recently.",
        ]


def evaluate_interview_answer(question: str, answer: str) -> dict:
    """
    Evaluates a candidate's answer to an interview question using AI.

    Returns:
        A dict with keys: feedback (str), score (float 0-10)
    """
    prompt = f"""
You are a senior technical interviewer evaluating a candidate's answer.

Question: {question}

Candidate's Answer: {answer}

Evaluate the answer on:
1. Technical accuracy
2. Clarity and structure
3. Depth of understanding
4. Real-world applicability

Return ONLY valid JSON with this exact structure:
{{
  "feedback": "Your detailed feedback here...",
  "score": 7.5
}}

The score must be a number between 0 and 10.
"""
    try:
        raw = _call_llm(prompt)
        result = _parse_json_from_response(raw)
        if isinstance(result, dict) and "feedback" in result and "score" in result:
            return {
                "feedback": str(result["feedback"]),
                "score": float(result.get("score", 5.0)),
            }
        return {"feedback": "Could not evaluate at this time.", "score": 5.0}
    except Exception as e:
        print(f"[AI] evaluate_interview_answer error: {e}")
        return {"feedback": "Evaluation service temporarily unavailable.", "score": 5.0}
