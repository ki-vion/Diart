from __future__ import annotations

import re

import fitz

from extractor.models import ExtractionResult, LineItem
from extractor.strategies.base import BaseStrategy
from extractor.utils import parse_de_number

_ARTNR = re.compile(r"^\d{8}$")
_QTY_UNIT = re.compile(r"^(?P<qty>[\d.,]+)\s+(?P<unit>.+)$")
_PRICE = re.compile(r"^[\d.,]+$")
_SKIP_PREFIXES = (
    "Artikel",
    "PREISBINDUNG",
    "Kom.:",
    "Dieser Artikel",
    "Die Rückgabe",
    "Alternativposition",
    "Sonstiges",
    "Menge Einheit",
)


class LaierVanStrategy(BaseStrategy):
    layout_id = "laier_van"

    def matches(self, doc: fitz.Document) -> bool:
        text = doc[0].get_text()
        return "VK-Preis" in text and ("Rudolf Laier" in text or "VAN0" in text)

    def extract(self, doc: fitz.Document, source_pdf: str) -> ExtractionResult:
        lines: list[str] = []
        for page in doc:
            lines.extend(line.strip() for line in page.get_text().splitlines())

        items: list[LineItem] = []
        position = 0
        i = 0
        while i < len(lines):
            line = lines[i]
            if not line or line.startswith(_SKIP_PREFIXES):
                i += 1
                continue
            if not _ARTNR.match(line):
                i += 1
                continue

            art = line
            if i + 4 >= len(lines):
                break
            desc = lines[i + 1]
            qty_match = _QTY_UNIT.match(lines[i + 2])
            price_line = lines[i + 3]
            total_line = lines[i + 4]
            if not qty_match or not _PRICE.match(price_line) or not _PRICE.match(
                total_line
            ):
                i += 1
                continue

            position += 1
            items.append(
                LineItem(
                    position=str(position),
                    article_number=art,
                    description=desc,
                    quantity=parse_de_number(qty_match.group("qty")),
                    unit=qty_match.group("unit"),
                    unit_price=parse_de_number(price_line),
                    line_total=parse_de_number(total_line),
                )
            )
            i += 5

        return ExtractionResult(
            layout_id=self.layout_id, source_pdf=source_pdf, items=items
        )
