"""
app/services/nlp_service.py
────────────────────────────
NLP analysis of interview answers using spaCy.

Provides:
  - Filler word detection
  - Fluency scoring
  - Vocabulary richness
  - Word count
"""

import re

# Filler words to detect
FILLER_WORDS = {
    "um", "uh", "umm", "uhh", "hmm", "er", "err",
    "like", "basically", "literally", "actually",
    "you know", "i mean", "sort of", "kind of",
    "right", "okay", "so", "well", "anyway",
}

_nlp = None  # lazy-loaded spacy model


def _get_nlp():
    """Lazy-load spaCy model once."""
    global _nlp
    if _nlp is None:
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            # Model not downloaded yet
            print("[NLP] spaCy model not found. Run: python -m spacy download en_core_web_sm")
            _nlp = None
    return _nlp


def analyze_answer(text: str) -> dict:
    """
    Analyze a spoken/written interview answer for NLP metrics.

    Returns:
        {
          "word_count": int,
          "filler_count": int,
          "filler_words_found": List[str],
          "fluency_score": float (0-10),
          "vocabulary_richness": float (0-1),
          "sentence_count": int,
          "avg_words_per_sentence": float
        }
    """
    if not text or not text.strip():
        return _empty_result()

    text_lower = text.lower().strip()
    words = text_lower.split()
    word_count = len(words)

    if word_count == 0:
        return _empty_result()

    # ── Filler word detection ──────────────────────────────────────────────
    filler_found = []

    # Single-word fillers
    for word in words:
        clean_word = re.sub(r'[^a-z]', '', word)
        if clean_word in FILLER_WORDS:
            filler_found.append(clean_word)

    # Multi-word fillers (e.g. "you know", "i mean")
    for filler in {"you know", "i mean", "sort of", "kind of"}:
        count = text_lower.count(filler)
        filler_found.extend([filler] * count)

    filler_count = len(filler_found)

    # ── Vocabulary richness (unique words / total words) ──────────────────
    unique_words = set(re.sub(r'[^a-z]', '', w) for w in words)
    unique_words.discard('')
    vocabulary_richness = round(len(unique_words) / word_count, 3)

    # ── Sentence analysis using spaCy (optional) ──────────────────────────
    sentence_count = 1
    avg_words_per_sentence = word_count

    nlp = _get_nlp()
    if nlp:
        doc = nlp(text)
        sentences = list(doc.sents)
        sentence_count = max(len(sentences), 1)
        avg_words_per_sentence = round(word_count / sentence_count, 1)

    # ── Fluency score (0–10) ──────────────────────────────────────────────
    # Deduct points for:
    #   - High filler ratio (filler/word_count)
    #   - Very short answers (< 20 words)
    #   - Very low vocabulary richness (< 0.3)
    filler_ratio = filler_count / word_count
    fluency = 10.0

    # Filler penalty (up to -4 points)
    fluency -= min(filler_ratio * 20, 4.0)

    # Short answer penalty (up to -3 points)
    if word_count < 20:
        fluency -= max(0, (20 - word_count) / 20 * 3)

    # Low vocabulary penalty (up to -2 points)
    if vocabulary_richness < 0.5:
        fluency -= (0.5 - vocabulary_richness) * 4

    fluency = round(max(fluency, 0.0), 1)

    return {
        "word_count": word_count,
        "filler_count": filler_count,
        "filler_words_found": list(set(filler_found)),
        "fluency_score": fluency,
        "vocabulary_richness": vocabulary_richness,
        "sentence_count": sentence_count,
        "avg_words_per_sentence": avg_words_per_sentence,
    }


def _empty_result() -> dict:
    return {
        "word_count": 0,
        "filler_count": 0,
        "filler_words_found": [],
        "fluency_score": 0.0,
        "vocabulary_richness": 0.0,
        "sentence_count": 0,
        "avg_words_per_sentence": 0.0,
    }
