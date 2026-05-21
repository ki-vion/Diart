from pathlib import Path

from extractor.pipeline import run_extraction

VORLAGEN = Path(__file__).resolve().parents[2] / "Vorlagen"
PDF = VORLAGEN / "KAN_1060020 EK Preis IFB.pdf"


def test_kan_ifb_extracts_positions_and_totals():
    result = run_extraction(PDF)
    assert result.layout_id == "kan_ifb"
    assert len(result.items) >= 4
    first = result.items[0]
    assert first.position == "001"
    assert first.article_number == "0206050001"
    assert first.quantity == 80.0
    assert first.unit == "l"
    assert first.line_total == 220.80


def test_kan_ifb_merges_description():
    result = run_extraction(PDF)
    first = result.items[0]
    assert "Tiefgrund" in first.description or "weber" in first.description
