# Art Advisor Platform

A professional platform for art advisors to manage gallery PDFs and create custom client portfolios.

## Features

- PDF parsing and artwork extraction
- Client portfolio management
- Custom PDF generation
- Art fair organization
- Gallery tracking
- Subscription management

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- PostgreSQL 13+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/moonj-asmr/art-advisor-platform.git
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Install backend dependencies:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
```

5. Start development servers:
```bash
# Terminal 1 - Frontend
cd frontend
npm run dev

# Terminal 2 - Backend
cd backend
uvicorn app.main:app --reload
```

## Architecture

- Frontend: React with TypeScript
- Backend: FastAPI
- Database: PostgreSQL
- File Storage: S3-compatible storage
- PDF Processing: PyMuPDF

## License

MIT License - see LICENSE file for details