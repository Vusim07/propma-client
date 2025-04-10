#!/bin/bash
set -e

# Check Python version
PYTHON_VERSION=$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
REQUIRED_VERSION="3.10"

echo "Running with Python $PYTHON_VERSION"
if (( $(echo "$PYTHON_VERSION < $REQUIRED_VERSION" | bc -l) )); then
  echo "Python version $REQUIRED_VERSION or higher is required for CrewAI"
  exit 1
fi

# Function to check if the port is available
wait_for_port() {
  echo "Checking if port $1 is available..."
  while nc -z localhost $1; do
    echo "Port $1 is still in use, waiting..."
    sleep 1
  done
  echo "Port $1 is available!"
}

# Wait for port to be available
wait_for_port 8000

# Start the FastAPI application
echo "Starting FastAPI application..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
