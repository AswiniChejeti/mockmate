"""
app/services/face_service.py
──────────────────────────────
Face capture and verification using DeepFace.

Provides:
  - extract_face_encoding()  — get face embedding from base64 image
  - verify_face()            — compare live face vs stored embedding
"""

import base64
import json
import os
import sys
import tempfile
import numpy as np


def _log(msg: str):
    """Safe console log that handles any Unicode characters."""
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode('ascii', errors='replace').decode(), flush=True)


def _base64_to_temp_file(base64_str: str) -> str:
    """Decode base64 image string, save to a temp file. Returns file path."""
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]
    image_data = base64.b64decode(base64_str)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
    tmp.write(image_data)
    tmp.close()
    return tmp.name


def extract_face_encoding(base64_image: str) -> list[float] | None:
    """
    Extract a 128-dim face embedding from a base64-encoded image.
    Uses DeepFace with the Facenet model.

    Returns:
        List of floats or None if no face detected / error.
    """
    tmp_path = None
    try:
        from deepface import DeepFace

        tmp_path = _base64_to_temp_file(base64_image)

        result = DeepFace.represent(
            img_path=tmp_path,
            model_name="Facenet",
            enforce_detection=True,
            detector_backend="opencv",   # fast & reliable
        )
        if len(result) > 1:
            raise ValueError(f"Multiple faces detected ({len(result)} faces). Please ensure only you are in the frame.")
            
        embedding = result[0]["embedding"]
        _log(f"[Face] Encoding extracted successfully (dim={len(embedding)})")
        return embedding

    except ValueError as e:
        # "Face could not be detected" — user photo had no face
        _log(f"[Face] No face detected in image: {str(e)[:120]}")
        return None
    except Exception as e:
        _log(f"[Face] extract_face_encoding error: {str(e)[:200]}")
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


def verify_face(
    live_base64: str,
    stored_encoding: list[float],
    threshold: float = 0.45,
) -> dict:
    """
    1. Count faces in frame using OpenCV Haar cascade (reliable multi-face detection).
    2. If 0 faces  → not verified (no face visible).
    3. If 2+ faces → not verified (unauthorized person present).
    4. If 1 face   → compare identity against stored embedding via DeepFace.
    """
    tmp_path = None
    try:
        import cv2
        from deepface import DeepFace

        tmp_path = _base64_to_temp_file(live_base64)

        # ── Step 1: Count faces with OpenCV cascade ────────────────────────────
        # cv2.CascadeClassifier is the reliable way to detect ALL faces in a frame.
        # DeepFace.represent() picks only ONE face, so it can't count multiple people.
        img = cv2.imread(tmp_path)
        if img is None:
            _log("[Face] Could not read image from temp file.")
            return {"verified": True, "distance": 0.5, "confidence": 0.5}

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        detected = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(60, 60),     # ignore tiny false positives
        )
        face_count = len(detected)
        _log(f"[Face] OpenCV detected {face_count} face(s) in frame.")

        if face_count > 1:
            _log(f"[Face] ANOMALY: {face_count} faces detected — unauthorized presence.")
            return {
                "verified": False,
                "distance": 1.0,
                "confidence": 0.0,
                "message": f"Multiple faces detected ({face_count} people in frame). Only the registered candidate should be visible."
            }

        if face_count == 0:
            _log("[Face] No face detected in frame.")
            return {
                "verified": False,
                "distance": 1.0,
                "confidence": 0.0,
                "message": "No face detected. Ensure good lighting and face the camera directly."
            }

        # ── Step 2: Identity verification using DeepFace ──────────────────────
        # Only reaches here when exactly 1 face is present.
        live_result = DeepFace.represent(
            img_path=tmp_path,
            model_name="Facenet",
            enforce_detection=False,
            detector_backend="opencv",
        )

        if not live_result:
            return {"verified": False, "distance": 1.0, "confidence": 0.0}

        live_embedding   = np.array(live_result[0]["embedding"])
        stored_embedding = np.array(stored_encoding)

        if np.linalg.norm(live_embedding) < 1e-6:
            return {"verified": False, "distance": 1.0, "confidence": 0.0,
                    "message": "Could not extract face embedding. Try better lighting."}

        dot        = np.dot(live_embedding, stored_embedding)
        norm       = np.linalg.norm(live_embedding) * np.linalg.norm(stored_embedding)
        similarity = float(dot / norm) if norm > 0 else 0.0
        distance   = round(1.0 - similarity, 4)
        verified   = distance < threshold
        confidence = round(max(0.0, 1.0 - distance), 4)

        _log(f"[Face] verified={verified}, distance={distance}, confidence={confidence}")
        return {"verified": verified, "distance": distance, "confidence": confidence}

    except Exception as e:
        _log(f"[Face] verify_face error: {str(e)[:200]}")
        # On unexpected errors, allow interview to continue (don't block unfairly)
        return {"verified": True, "distance": 0.5, "confidence": 0.5}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

