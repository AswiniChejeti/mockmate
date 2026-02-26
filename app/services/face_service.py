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
    Compare a live webcam image against a stored face encoding.

    Args:
        live_base64:      Base64 JPEG from webcam
        stored_encoding:  128-dim float list from DB
        threshold:        Cosine distance threshold (lower = stricter)
                          0.45 = reasonable balance for Facenet

    Returns:
        {"verified": bool, "distance": float, "confidence": float}
    """
    tmp_path = None
    try:
        from deepface import DeepFace

        tmp_path = _base64_to_temp_file(live_base64)
        live_result = DeepFace.represent(
            img_path=tmp_path,
            model_name="Facenet",
            enforce_detection=True,
            detector_backend="opencv",
        )

        if len(live_result) > 1:
            _log(f"[Face] Verification failed: Multiple faces detected ({len(live_result)} faces).")
            return {
                "verified": False,
                "distance": 1.0,
                "confidence": 0.0,
                "message": "Multiple faces detected in the camera frame. Please ensure only you are visible."
            }

        live_embedding  = np.array(live_result[0]["embedding"])
        stored_embedding = np.array(stored_encoding)

        # Cosine similarity → distance
        dot  = np.dot(live_embedding, stored_embedding)
        norm = np.linalg.norm(live_embedding) * np.linalg.norm(stored_embedding)
        similarity = float(dot / norm) if norm > 0 else 0.0
        distance   = round(1.0 - similarity, 4)
        verified   = distance < threshold
        confidence = round(max(0.0, 1.0 - distance), 4)

        _log(f"[Face] Verification result: verified={verified}, distance={distance}, confidence={confidence}")
        return {"verified": verified, "distance": distance, "confidence": confidence}

    except ValueError:
        # No face in live image
        _log("[Face] verify_face: No face detected in live image")
        return {"verified": False, "distance": 1.0, "confidence": 0.0}
    except Exception as e:
        _log(f"[Face] verify_face error: {str(e)[:200]}")
        return {"verified": False, "distance": 1.0, "confidence": 0.0}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
