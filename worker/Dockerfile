FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for package management
RUN pip install uv

# Copy project files
COPY pyproject.toml .
COPY . .

# Install dependencies
RUN uv sync --no-dev

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD celery -A main inspect ping --timeout 5 || exit 1

# Default command - start worker (threads pool to avoid DuckDB fork crashes)
CMD ["celery", "-A", "main", "worker", \
     "--loglevel=info", \
     "-Q", "preview,default", \
     "-c", "4", \
     "--pool=threads"]
