import fitz

from extractor.models import ExtractionResult
from extractor.strategies.base import BaseStrategy


class Layout5Strategy(BaseStrategy):
    layout_id = "layout_5"

    def matches(self, doc: fitz.Document) -> bool:
        return False

    def extract(self, doc: fitz.Document, source_pdf: str) -> ExtractionResult:
        raise NotImplementedError("layout_5: PDF-Vorlage fehlt noch")
