import pytest
from app.services.portfolio_generator import PortfolioGenerator

@pytest.fixture
def portfolio_generator():
    return PortfolioGenerator()

def test_generate_pdf(portfolio_generator):
    artworks = [
        {
            'title': 'Test Artwork',
            'artist': 'Test Artist',
            'year': '2023',
            'medium': 'Oil on canvas',
            'dimensions': '60.5 × 50 cm',
            'price': '$45,000'
        }
    ]
    
    client_info = {'name': 'Test Client'}
    pdf_content = portfolio_generator.generate_pdf(artworks, client_info)
    assert pdf_content is not None
    assert len(pdf_content) > 0