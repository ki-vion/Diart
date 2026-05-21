from pathlib import Path

import fitz
import pytest

from extractor.detector import detect_layout


def test_unknown_pdf_raises(tmp_path):
    fake = tmp_path / "empty.pdf"
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), "Unbekannter Lieferant XYZ")
    doc.save(fake)
    doc.close()
    with pytest.raises(ValueError, match="Unbekanntes"):
        detect_layout(fake)
