"""
Final end-to-end test: generate 5 Python MCQs using the updated ai_service.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.services.ai_service import generate_mcqs

print("Testing generate_mcqs(skill='Python', num_questions=5, level='Medium')...\n")
questions = generate_mcqs(skill="Python", num_questions=5, level="Medium")

print(f"\nGot {len(questions)} questions:\n")
for i, q in enumerate(questions):
    print(f"Q{i+1}: {q['question']}")
    for opt in q['options']:
        marker = " <-- CORRECT" if opt['key'] == q['correct_answer'] else ""
        print(f"     {opt['key']}. {opt['value']}{marker}")
    print(f"     Explanation: {q['explanation'][:80]}")
    print()

if len(questions) == 5:
    print("SUCCESS - Got exactly 5 questions!")
else:
    print(f"WARNING - Expected 5, got {len(questions)}")
