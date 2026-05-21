import fitz

from extractor.models import ExtractionResult
from extractor.strategies.base import BaseStrategy


class Layout6Strategy(BaseStrategy):
    layout_id = "layout_6"

    def matches(self, doc: fitz.Document) -> bool:
        return False

    def extract(self, doc: fitz.Document, source_pdf: str) -> ExtractionResult:
        raise NotImplementedError("layout_6: PDF-Vorlage fehlt noch")
