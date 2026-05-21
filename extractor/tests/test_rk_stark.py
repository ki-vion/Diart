from pathlib import Path

from extractor.pipeline import run_extraction

PDF = Path(__file__).resolve().parents[2] / "Vorlagen" / "RK - Fermacell.pdf"


def test_rk_stark_fermacell_line():
    result = run_extraction(PDF)
    assert result.layout_id == "rk_stark"
    arts = [i.article_number for i in result.items]
    assert "330240" in arts
