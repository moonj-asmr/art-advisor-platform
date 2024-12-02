from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..dependencies import get_current_user, get_db
from ..models import User, Portfolio
from ..schemas.portfolio import PortfolioCreate, PortfolioResponse
from ..services.portfolio_generator import PortfolioGenerator

router = APIRouter(prefix='/portfolios', tags=['portfolios'])

@router.post('/', response_model=PortfolioResponse)
async def create_portfolio(
    portfolio: PortfolioCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new client portfolio."""
    portfolio_gen = PortfolioGenerator()
    
    # Generate PDF
    pdf_content = await portfolio_gen.generate_pdf(
        artworks=portfolio.artworks,
        client_info={
            'name': portfolio.client_name
        }
    )
    
    # Save to database
    db_portfolio = Portfolio(
        title=portfolio.title,
        client_name=portfolio.client_name,
        owner_id=current_user.id
    )
    db.add(db_portfolio)
    db.commit()
    db.refresh(db_portfolio)
    
    return PortfolioResponse(
        id=db_portfolio.id,
        title=db_portfolio.title,
        client_name=db_portfolio.client_name,
        artwork_count=len(portfolio.artworks)
    )
