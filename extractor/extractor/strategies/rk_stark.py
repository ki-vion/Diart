from __future__ import annotations

from collections import defaultdict

import fitz

from extractor.models import ExtractionResult, LineItem
from extractor.strategies.base import BaseStrategy
from extractor.utils import parse_de_number

TABLE_Y_MIN = 640
TABLE_Y_MAX = 760
COL_POS = 42
COL_ART = 77
COL_QTY = 306
COL_UNIT = 323
COL_PRICE = 397
COL_TOTAL = 519
TOLERANCE = 25


def _nearest_col(x: float) -> str | None:
    columns = {
        "pos": COL_POS,
        "art": COL_ART,
        "qty": COL_QTY,
        "unit": COL_UNIT,
        "price": COL_PRICE,
        "total": COL_TOTAL,
    }
    best = min(columns.items(), key=lambda item: abs(x - item[1]))
    if abs(x - best[1]) <= TOLERANCE:
        return best[0]
    return None


class RkStarkStrategy(BaseStrategy):
    layout_id = "rk_stark"

    def matches(self, doc: fitz.Document) -> bool:
        text = doc[0].get_text()
        return "STARK Deutschland" in text or "Raab Karcher" in text

    def extract(self, doc: fitz.Document, source_pdf: str) -> ExtractionResult:
        items: list[LineItem] = []

        for page in doc:
            rows: dict[float, dict[str, list[str]]] = defaultdict(
                lambda: defaultdict(list)
            )
            for word in page.get_text("words"):
                x0, y0, _x1, _y1, text, *_ = word
                if not (TABLE_Y_MIN <= y0 <= TABLE_Y_MAX):
                    continue
                col = _nearest_col(x0)
                if col:
                    rows[round(y0, 0)][col].append(text)

            sorted_rows = sorted(rows.items(), key=lambda item: item[0])
            current: LineItem | None = None
            desc_parts: list[str] = []

            for _y, cols in sorted_rows:
                pos_tokens = cols.get("pos", [])
                art_tokens = cols.get("art", [])
                if pos_tokens and art_tokens and pos_tokens[0].isdigit():
                    if current and desc_parts:
                        current.description = " ".join(desc_parts).strip()
                    desc_parts = []
                    qty_text = " ".join(cols.get("qty", []))
                    unit_text = " ".join(cols.get("unit", []))
                    price_text = " ".join(cols.get("price", []))
                    total_text = " ".join(cols.get("total", []))
                    quantity = (
                        parse_de_number(qty_text.split()[0])
                        if qty_text
                        else None
                    )
                    unit_price = None
                    line_total = None
                    if price_text:
                        price_num = price_text.replace("EUR/1", "").replace("EUR", "")
                        parts = price_num.split()
                        if parts:
                            unit_price = parse_de_number(parts[0])
                    if total_text:
                        line_total = parse_de_number(total_text)
                    current = LineItem(
                        position=pos_tokens[0],
                        article_number=art_tokens[0],
                        description=" ".join(art_tokens[1:]),
                        quantity=quantity,
                        unit=unit_text.split()[0] if unit_text else None,
                        unit_price=unit_price,
                        line_total=line_total,
                    )
                    items.append(current)
                    continue

                if current and art_tokens and not pos_tokens:
                    desc_parts.extend(art_tokens)

            if current and desc_parts:
                current.description = (
                    f"{current.description} {' '.join(desc_parts)}".strip()
                )

        return ExtractionResult(
            layout_id=self.layout_id, source_pdf=source_pdf, items=items
        )
