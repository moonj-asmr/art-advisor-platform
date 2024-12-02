#!/bin/bash

# Build and push Docker images
docker-compose build
docker-compose push

# Apply database migrations
docker-compose run --rm backend alembic upgrade head

# Restart services
docker-compose down
docker-compose up -d

echo "Deployment complete!"