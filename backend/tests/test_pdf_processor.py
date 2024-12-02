import pytest
from app.services.pdf_processor import PDFProcessor
from app.services.pdf_extractor import PDFExtractor

@pytest.fixture
def pdf_processor():
    return PDFProcessor()

@pytest.fixture
def pdf_extractor():
    return PDFExtractor()

def test_extract_price():
    extractor = PDFExtractor()
    text = "Beautiful Artwork, 2023\nOil on canvas\n$45,000"
    result = extractor.extract_artwork_info(text)
    assert result['price'] == '$45,000'

def test_extract_dimensions():
    extractor = PDFExtractor()
    text = "Dimensions: 60.5 × 50 cm"
    result = extractor.extract_artwork_info(text)
    assert result['dimensions'] == '60.5 × 50 cm'

def test_extract_year():
    extractor = PDFExtractor()
    text = "Created in 2023"
    result = extractor.extract_artwork_info(text)
    assert result['year'] == '2023'