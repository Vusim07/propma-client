#!/bin/bash
set -e

# Environment configuration
PYTHON_VERSION=$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
REQUIRED_VERSION="3.10"
APP_HOST=${HOST:-0.0.0.0}
APP_PORT=${PORT:-8000}
RELOAD=${RELOAD:-0}  # Default disabled for production

# Ensure we're in the correct directory
cd /app

# Version check
echo "Running with Python $PYTHON_VERSION"
if (( $(echo "$PYTHON_VERSION < $REQUIRED_VERSION" | bc -l) )); then
  echo "Python version $REQUIRED_VERSION or higher is required for CrewAI"
  exit 1
fi

# Port availability check (only in production mode)
if [ "$RELOAD" = "0" ]; then
  echo "Checking port $APP_PORT..."
  for i in {1..5}; do
    if ! nc -z localhost $APP_PORT; then
      break
    fi
    if [ $i -eq 5 ]; then
      echo "Port $APP_PORT still in use after 5 attempts"
      exit 1
    fi
    echo "Port $APP_PORT in use, retrying ($i/5)..."
    sleep 1
  done;
fi

# Debug information
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la
echo "Python path: $PYTHONPATH"

# Start command construction
CMD="uvicorn main:app --host $APP_HOST --port $APP_PORT"
[ "$RELOAD" = "1" ] && CMD="$CMD --reload"

# Start the application
echo "Starting FastAPI application: $CMD"
exec $CMD