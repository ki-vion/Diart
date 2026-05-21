from __future__ import annotations

import re

import fitz

from extractor.models import ExtractionResult, LineItem
from extractor.strategies.base import BaseStrategy
from extractor.utils import parse_de_number

_POS = re.compile(r"^\d{3}$")
_NET = re.compile(r"^(?P<net>[\d.,]+)\s+EUR\s*$", re.IGNORECASE)
_QTY = re.compile(
    r"^(?P<qty>[\d.,]+)\s+(?P<unit>m²|m2|St|kg|l|qm)\s*$", re.IGNORECASE
)
_UNIT_PRICE = re.compile(
    r"^(?P<price>[\d.,]+)\s+EUR\s*/\s*(?P<per>\S+)\s*$", re.IGNORECASE
)
_ARTNR = re.compile(r"^\d{8}$")
_SKIP = (
    "Pos",
    "Nettowert",
    "Einzelpreis",
    "Artikel",
    "Abw.",
    "Menge",
    "Übertrag",
    "Zolltarif",
    "Produkt",
    "CoC-",
    "Länge:",
    "Breite:",
    "Charge:",
    "VPE:",
    "Abmessung:",
    "Artikelnummer:",
    "EUR",
)


class NoritRechnungStrategy(BaseStrategy):
    layout_id = "norit_rechnung"

    def matches(self, doc: fitz.Document) -> bool:
        text = doc[0].get_text()
        return "Rechnungsnummer:" in text and "Einzelpreis" in text

    def extract(self, doc: fitz.Document, source_pdf: str) -> ExtractionResult:
        lines: list[str] = []
        for page in doc:
            lines.extend(line.strip() for line in page.get_text().splitlines())

        items: list[LineItem] = []
        i = 0
        while i < len(lines):
            if not _POS.match(lines[i]):
                i += 1
                continue
            if i + 1 >= len(lines):
                break
            net_match = _NET.match(lines[i + 1])
            if not net_match:
                i += 1
                continue

            position = lines[i]
            line_total = parse_de_number(net_match.group("net"))
            desc_parts: list[str] = []
            quantity = None
            unit = None
            unit_price = None
            article_number = None

            j = i + 2
            while j < len(lines):
                line = lines[j]
                if _POS.match(line) and j + 1 < len(lines) and _NET.match(lines[j + 1]):
                    break
                if line.startswith(_SKIP):
                    j += 1
                    continue
                qty_match = _QTY.match(line)
                if qty_match:
                    quantity = parse_de_number(qty_match.group("qty"))
                    unit = qty_match.group("unit")
                    j += 1
                    continue
                price_match = _UNIT_PRICE.match(line)
                if price_match:
                    unit_price = parse_de_number(price_match.group("price"))
                    j += 1
                    continue
                if _ARTNR.match(line):
                    article_number = line
                    j += 1
                    continue
                if line and not line.endswith("EUR"):
                    desc_parts.append(line)
                j += 1

            items.append(
                LineItem(
                    position=position,
                    article_number=article_number,
                    description=" ".join(desc_parts).strip(),
                    quantity=quantity,
                    unit=unit,
                    unit_price=unit_price,
                    line_total=line_total,
                )
            )
            i = j

        return ExtractionResult(
            layout_id=self.layout_id, source_pdf=source_pdf, items=items
        )
