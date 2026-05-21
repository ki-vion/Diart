from __future__ import annotations

from abc import ABC, abstractmethod

import fitz

from extractor.models import ExtractionResult


class BaseStrategy(ABC):
    layout_id: str

    @abstractmethod
    def matches(self, doc: fitz.Document) -> bool:
        ...

    @abstractmethod
    def extract(self, doc: fitz.Document, source_pdf: str) -> ExtractionResult:
        ...
