# Stage 1: Build stage
FROM python:3.11-slim AS builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    VENV_PATH="/opt/pysetup/.venv"

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    netcat-traditional \
    libmagic1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
RUN python -m venv $VENV_PATH
ENV PATH="$VENV_PATH/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Copy all application files
COPY . .

# Stage 2: Runtime stage
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    VENV_PATH="/opt/pysetup/.venv" \
    PATH="/opt/pysetup/.venv/bin:$PATH"

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends netcat-traditional bc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy virtual environment and app
COPY --from=builder /opt/pysetup/.venv /opt/pysetup/.venv
COPY --from=builder /app /app

# Copy start script from scripts directory and make it executable
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

# Fix permissions for non-root user
RUN useradd -m amara && \
    chown -R amara:amara /app && \
    chown -R amara:amara /opt/pysetup && \
    chown -R amara:amara /start.sh

USER amara

EXPOSE 8000
CMD ["/start.sh"]