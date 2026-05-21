from __future__ import annotations

from pathlib import Path

import fitz

from extractor.detector import STRATEGIES
from extractor.models import ExtractionResult


def run_extraction(pdf_path: Path) -> ExtractionResult:
    doc = fitz.open(pdf_path)
    try:
        for strategy in STRATEGIES:
            if strategy.matches(doc):
                return strategy.extract(doc, str(pdf_path))
        raise ValueError(f"Unbekanntes Layout: {pdf_path}")
    finally:
        doc.close()
