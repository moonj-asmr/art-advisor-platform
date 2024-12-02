# Art Advisor Platform API Documentation

## Authentication

### POST /auth/login
Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "access_token": "string",
  "token_type": "bearer"
}
```

## PDF Management

### POST /upload/pdf
Upload a PDF file for processing.

**Request:**
- Content-Type: multipart/form-data
- Body: file (PDF)

**Response:**
```json
{
  "id": "string",
  "filename": "string",
  "artwork_count": 0
}
```

### GET /artworks
Retrieve processed artworks.

**Response:**
```json
[
  {
    "id": "string",
    "title": "string",
    "artist": "string",
    "year": "string",
    "medium": "string",
    "dimensions": "string",
    "price": "string"
  }
]
```

## Portfolio Management

### POST /portfolios
Create a new client portfolio.

**Request Body:**
```json
{
  "title": "string",
  "client_name": "string",
  "artwork_ids": ["string"]
}
```

**Response:**
```json
{
  "id": "string",
  "title": "string",
  "client_name": "string",
  "artwork_count": 0
}
```