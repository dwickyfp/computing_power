#!/bin/bash
# Start the Rosetta Worker service (HIGH PERFORMANCE)
# Usage: ./start.sh [options]
#
# Options:
#   --concurrency N    Number of worker threads (default: 8)
#   --queues Q         Comma-separated queue names (default: preview,default)
#   --loglevel LEVEL   Log level (default: info)
#   --beat             Also start Celery Beat scheduler

set -e

cd "$(dirname "$0")"

CONCURRENCY=${WORKER_CONCURRENCY:-8}
QUEUES="preview,default"
LOGLEVEL=${LOG_LEVEL:-info}
RUN_BEAT=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --concurrency) CONCURRENCY=$2; shift 2 ;;
        --queues) QUEUES=$2; shift 2 ;;
        --loglevel) LOGLEVEL=$2; shift 2 ;;
        --beat) RUN_BEAT=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "Starting Rosetta Worker..."
echo "  Concurrency: $CONCURRENCY"
echo "  Queues: $QUEUES"
echo "  Log Level: $LOGLEVEL"

# Start health API server in background
echo "Starting health API server on port ${SERVER_PORT:-8002}..."
python server.py &
HEALTH_PID=$!
echo "  Health API PID: $HEALTH_PID"

# Trap to clean up health server on exit
trap "echo 'Stopping health API server...'; kill $HEALTH_PID 2>/dev/null" EXIT INT TERM

if [ "$RUN_BEAT" = true ]; then
    echo "  Beat: enabled"
    celery -A main worker \
        --loglevel=$LOGLEVEL \
        -Q $QUEUES \
        -c $CONCURRENCY \
        --pool=threads \
        --beat
else
    celery -A main worker \
        --loglevel=$LOGLEVEL \
        -Q $QUEUES \
        -c $CONCURRENCY \
        --pool=threads
fi
