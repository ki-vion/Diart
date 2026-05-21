from pathlib import Path

from extractor.pipeline import run_extraction

PDF = Path(__file__).resolve().parents[2] / "Vorlagen" / "Verkauf - Angebot_VAN029183.pdf"


def test_laier_van_first_article():
    result = run_extraction(PDF)
    assert result.layout_id == "laier_van"
    nums = [i.article_number for i in result.items if i.article_number]
    assert "33011303" in nums
    row = next(i for i in result.items if i.article_number == "33011303")
    assert row.quantity == 57.0
    assert row.unit and "Sack" in row.unit
    assert row.line_total == 675.45
