from extractor.models import LineItem, ExtractionResult, ExportOptions


def test_line_item_fields():
    item = LineItem(
        position="001",
        article_number="0206050001",
        description="weber.prim 400 Tiefgrund",
        quantity=80.0,
        unit="l",
        unit_price=2.76,
        line_total=220.80,
    )
    assert item.position == "001"
    assert item.line_total == 220.80


def test_artikel_label_merges_number():
    item = LineItem(
        position="1",
        article_number="0206050001",
        description="Tiefgrund",
        quantity=1.0,
        unit="l",
        unit_price=1.61,
        line_total=1.61,
    )
    assert item.artikel_label() == "0206050001 Tiefgrund"


def test_export_options_default_aufschlag():
    opts = ExportOptions()
    assert opts.aufschlag == 0.2


def test_extraction_result_roundtrip():
    r = ExtractionResult(
        layout_id="kan_ifb",
        source_pdf="angebot.pdf",
        items=[
            LineItem(
                position="1",
                article_number=None,
                description="x",
                quantity=1.0,
                unit="St",
                unit_price=1.0,
                line_total=1.0,
            )
        ],
    )
    assert r.layout_id == "kan_ifb"
    assert len(r.items) == 1
