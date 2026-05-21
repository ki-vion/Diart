from __future__ import annotations

import re

import fitz

from extractor.models import ExtractionResult, LineItem
from extractor.strategies.base import BaseStrategy
from extractor.utils import parse_de_number

_POS_HEAD = re.compile(r"^(?P<pos>\d{3})\s+Artikelnummer:\s+(?P<art>\S+)")


class KanIfbStrategy(BaseStrategy):
    layout_id = "kan_ifb"

    def matches(self, doc: fitz.Document) -> bool:
        text = doc[0].get_text()
        return "ANGEBOT" in text and "Beleg" in text and "KAN" in text

    def extract(self, doc: fitz.Document, source_pdf: str) -> ExtractionResult:
        lines: list[str] = []
        for page in doc:
            lines.extend(line.strip() for line in page.get_text().splitlines())

        items: list[LineItem] = []
        i = 0
        while i < len(lines):
            match = _POS_HEAD.match(lines[i])
            if not match:
                i += 1
                continue
            if i + 4 >= len(lines):
                break
            qty_line = lines[i + 1]
            unit_line = lines[i + 2]
            price_line = lines[i + 3]
            total_line = lines[i + 4]
            desc_lines: list[str] = []
            j = i + 5
            while j < len(lines) and not _POS_HEAD.match(lines[j]):
                if lines[j] in ("Pos.", "Übertrag", "Betrag EUR") or lines[j].startswith(
                    "Übertrag"
                ):
                    break
                desc_lines.append(lines[j])
                j += 1
            items.append(
                LineItem(
                    position=match.group("pos"),
                    article_number=match.group("art"),
                    description=" ".join(desc_lines).strip(),
                    quantity=parse_de_number(qty_line),
                    unit=unit_line,
                    unit_price=parse_de_number(price_line),
                    line_total=parse_de_number(total_line),
                )
            )
            i = j

        return ExtractionResult(
            layout_id=self.layout_id, source_pdf=source_pdf, items=items
        )
