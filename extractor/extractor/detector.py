from __future__ import annotations

from pathlib import Path

import fitz

from extractor.strategies.kan_ifb import KanIfbStrategy
from extractor.strategies.laier_van import LaierVanStrategy
from extractor.strategies.norit_rechnung import NoritRechnungStrategy
from extractor.strategies.rk_stark import RkStarkStrategy

STRATEGIES = [
    KanIfbStrategy(),
    NoritRechnungStrategy(),
    RkStarkStrategy(),
    LaierVanStrategy(),
]


def detect_layout(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    try:
        for strategy in STRATEGIES:
            if strategy.matches(doc):
                return strategy.layout_id
        raise ValueError(f"Unbekanntes PDF-Layout: {pdf_path.name}")
    finally:
        doc.close()
