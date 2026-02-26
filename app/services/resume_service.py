"""
app/services/resume_service.py
───────────────────────────────
Handles PDF resume text extraction using pdfplumber.

pdfplumber is a Python library that can read text from PDFs accurately,
even when PDFs have tables or multiple columns.
"""

import os
import pdfplumber


def extract_text_from_pdf(file_path: str) -> str:
    """
    Reads every page of a PDF and extracts all text.

    Args:
        file_path: Absolute path to the saved PDF file.

    Returns:
        A single string containing all the text from the PDF.
        Returns empty string if extraction fails.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF not found at path: {file_path}")

    full_text = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                full_text.append(page_text)

    return "\n".join(full_text)


def save_uploaded_file(file_content: bytes, filename: str, upload_dir: str = "uploads") -> str:
    """
    Saves an uploaded file to the uploads directory.

    Args:
        file_content: Raw bytes of the uploaded file.
        filename: Original filename.
        upload_dir: Directory to save the file (created if not exists).

    Returns:
        The absolute file path where the file was saved.
    """
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        f.write(file_content)
    return file_path
