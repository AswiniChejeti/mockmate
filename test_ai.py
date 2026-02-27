"""
test_ai.py  --  Auto-detect the working Gemini model and verify AI evaluation.

Run this BEFORE starting the server:
    py test_ai.py

It will:
  1. Try all known Gemini models with a simple prompt
  2. Print which models work and which fail
  3. Run a quick evaluation test to confirm JSON parsing works
"""

import sys
import os
import re
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if not GEMINI_API_KEY:
    print("[ERROR] GEMINI_API_KEY not found in .env -- cannot test.")
    sys.exit(1)

print("=" * 60)
print("  Gemini Model Availability Test")
print("=" * 60)

try:
    from google import genai
except ImportError:
    print("[ERROR] google-genai not installed. Run: pip install google-genai")
    sys.exit(1)

client = genai.Client(api_key=GEMINI_API_KEY)

# First discover which models are available for this API key
print("\nDiscovering available models...")
try:
    all_models = [m.name for m in client.models.list() if "generateContent" in str(m)]
    # Filter to only gemini text models (exclude audio/image/embedding)
    MODELS_TO_TEST = [
        m.replace("models/", "") for m in all_models
        if "gemini" in m and "audio" not in m and "image" not in m
        and "tts" not in m and "vision" not in m and "embedding" not in m
    ]
    print(f"Found {len(MODELS_TO_TEST)} candidate models: {MODELS_TO_TEST}")
except Exception as e:
    print(f"Could not list models ({e}), using defaults.")
    MODELS_TO_TEST = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash",
    ]

SIMPLE_PROMPT = 'Reply with ONLY this exact JSON: {"status": "ok", "model": "working"}'

EVAL_PROMPT = '''You are a technical interviewer evaluating a spoken answer.

Question: What is a Python list?

Candidate Answer: A list in Python is a mutable ordered collection that can hold items of different types. You can add, remove, or modify elements.

Return ONLY valid JSON, no extra text, no markdown fences.
{"feedback": "your feedback here", "score": 8.5}

Score must be between 0 and 10.'''

working_models = []

failed_models = []

for model in MODELS_TO_TEST:
    try:
        response = client.models.generate_content(model=model, contents=SIMPLE_PROMPT)
        text = response.text.strip()
        clean = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()
        try:
            data = json.loads(clean)
            print(f"  [OK]   {model:<30} -> {data}")
        except json.JSONDecodeError:
            print(f"  [OK]   {model:<30} -> responded: {text[:60]}")
        working_models.append(model)
    except Exception as e:
        err = str(e)[:100].replace("\n", " ")
        print(f"  [FAIL] {model:<30} -> {type(e).__name__}: {err}")
        failed_models.append(model)

print()
print(f"Working: {len(working_models)} | Failed: {len(failed_models)}")

if not working_models:
    print("\n[ERROR] NO working Gemini models found! Check your GEMINI_API_KEY.")
    sys.exit(1)

best_model = working_models[0]
print(f"\n[BEST] Primary model to use: {best_model}")

# -- Test actual evaluation JSON parsing ----------------------------------------
print()
print("=" * 60)
print("  Evaluation JSON Parsing Test  (using " + best_model + ")")
print("=" * 60)

try:
    response = client.models.generate_content(model=best_model, contents=EVAL_PROMPT)
    raw = response.text.strip()
    print("Raw LLM response:")
    print(raw)
    print()

    clean = re.sub(r"```(?:json|python)?\s*", "", raw).replace("```", "").strip()
    parsed = None
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', clean, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))

    if parsed and "feedback" in parsed and "score" in parsed:
        print("[OK] JSON parsed successfully!")
        print(f"     Score   : {parsed['score']}/10")
        print(f"     Feedback: {str(parsed['feedback'])[:120]}")
    else:
        print(f"[WARN] Response parsed but missing fields: {parsed}")

except Exception as e:
    print(f"[ERROR] Evaluation test failed: {type(e).__name__}: {e}")

# -- Summary -------------------------------------------------------------------
print()
print("=" * 60)
print("  Recommended model order for ai_service.py:")
for i, m in enumerate(working_models):
    print(f"  {i+1}. {m}")
print()
print("  ai_service.py already tries them in this order automatically.")
print("=" * 60)
