from __future__ import annotations

from dataclasses import dataclass


@dataclass
class LineItem:
    position: str | None
    article_number: str | None
    description: str
    quantity: float | None
    unit: str | None
    unit_price: float | None
    line_total: float | None

    def artikel_label(self) -> str:
        parts = [p for p in (self.article_number, self.description) if p]
        return " ".join(parts)


@dataclass
class ExportOptions:
    aufschlag: float = 0.2


@dataclass
class ExtractionResult:
    layout_id: str
    source_pdf: str
    items: list[LineItem]
