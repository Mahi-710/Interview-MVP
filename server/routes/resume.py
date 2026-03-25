import io
from fastapi import APIRouter, HTTPException, UploadFile, File
from PyPDF2 import PdfReader
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image, ImageFilter

router = APIRouter(prefix="/api/resume")

MAX_PDF_BYTES = 1 * 1024 * 1024  # 1 MB


def validate_pdf(pdf_bytes: bytes):
    # Basic header check
    if not pdf_bytes.startswith(b"%PDF"):
        raise ValueError("Invalid PDF: missing file header")

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))

        # Ensure PDF has pages
        if not reader.pages or len(reader.pages) == 0:
            raise ValueError("Invalid PDF: no pages found")

        # Force parsing of first page
        _ = reader.pages[0]

    except Exception:
        raise ValueError("Malformed or corrupted PDF file")


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    # Tier 1: Try direct text extraction (fast path for text-based PDFs)
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text.strip())
        text = "\n\n".join(text_parts).strip()
        if len(text) > 50:
            print(f"PDF text extraction successful: {len(text)} chars from {len(reader.pages)} pages")
            return text
    except Exception as e:
        print(f"Direct text extraction failed, falling back to OCR: {e}")

    # Tier 2: OCR path for scanned/image-based PDFs
    print("Starting OCR pipeline...")
    try:
        images = convert_from_bytes(pdf_bytes, dpi=300)
        ocr_results = []
        for i, img in enumerate(images[:20]):  # Cap at 20 pages
            try:
                # Preprocess for better OCR
                img = img.convert("L")  # Grayscale
                img = img.filter(ImageFilter.SHARPEN)
                page_text = pytesseract.image_to_string(img, lang="eng")
                ocr_results.append(page_text.strip())
                print(f"OCR page {i + 1}: {len(page_text.strip())} chars")
            except Exception as page_err:
                print(f"OCR failed for page {i + 1}: {page_err}")

        combined = "\n\n".join(ocr_results).strip()
        if len(combined) > 0:
            print(f"OCR complete: {len(combined)} total chars")
            return combined
    except Exception as e:
        print(f"OCR pipeline failed: {e}")

    raise ValueError("Could not extract text from PDF. Please paste your resume text instead.")


@router.post("/parse")
async def parse_resume(resume: UploadFile = File(...)):
    if not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    try:
        pdf_bytes = await resume.read()

        # ✅ 1MB size validation (reliable)
        if len(pdf_bytes) > MAX_PDF_BYTES:
            size_mb = len(pdf_bytes) / (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"File too large ({size_mb:.2f} MB) — max allowed is 1 MB"
            )

        # ✅ Malformed / corrupt PDF validation
        try:
            validate_pdf(pdf_bytes)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Existing extraction logic (unchanged)
        text = extract_text_from_pdf(pdf_bytes)
        return {"text": text}

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"Resume parse error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse resume")