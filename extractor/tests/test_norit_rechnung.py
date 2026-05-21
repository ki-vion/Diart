from pathlib import Path

from extractor.pipeline import run_extraction

PDF = Path(__file__).resolve().parents[2] / "Vorlagen" / "Norit Rechnung.pdf"


def test_norit_first_line_net_value():
    result = run_extraction(PDF)
    assert result.layout_id == "norit_rechnung"
    assert any(i.line_total and i.line_total >= 1217.0 for i in result.items)
