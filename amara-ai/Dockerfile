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

# Copy application files in correct order
COPY requirements.txt .
COPY main.py .
COPY src/ ./src/
COPY scripts/ ./scripts/

# Remove duplicate COPY commands
# RUN mkdir commands since directories are created by COPY
RUN chmod +x /app/scripts/start.sh

# Set the working directory to ensure main.py is found
WORKDIR /app

# Stage 2: Runtime stage
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    VENV_PATH="/opt/pysetup/.venv" \
    PATH="/opt/pysetup/.venv/bin:$PATH"

# Arguments for user/group IDs (matches your VPS UID/GID)
ARG USER_ID=1001
ARG GROUP_ID=1002

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends netcat-traditional bc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy virtual environment and app
COPY --from=builder /opt/pysetup/.venv /opt/pysetup/.venv
COPY --from=builder /app /app

# Create directories needed for volumes
RUN mkdir -p /app/nginx/certbot && \
    mkdir -p /app/static

# Copy start script and set permissions
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

# Create user with specific UID/GID to match VPS
RUN groupadd -g ${GROUP_ID} amara && \
    useradd -u ${USER_ID} -g amara -m amara && \
    chown -R amara:amara /app && \
    chown -R amara:amara /opt/pysetup && \
    chown -R amara:amara /start.sh && \
    chown -R amara:amara /app/nginx/certbot

USER amara

EXPOSE 8000
CMD ["/start.sh"]