#!/bin/bash
# Start the Rosetta Worker service
# Usage: ./start.sh [options]
#
# Options:
#   --concurrency N    Number of worker processes (default: 4)
#   --queues Q         Comma-separated queue names (default: preview,default)
#   --loglevel LEVEL   Log level (default: info)
#   --beat             Also start Celery Beat scheduler

set -e

cd "$(dirname "$0")"

CONCURRENCY=${WORKER_CONCURRENCY:-4}
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

if [ "$RUN_BEAT" = true ]; then
    echo "  Beat: enabled"
    uv run celery -A main worker \
        --loglevel=$LOGLEVEL \
        -Q $QUEUES \
        -c $CONCURRENCY \
        --pool=threads \
        --beat
else
    uv run celery -A main worker \
        --loglevel=$LOGLEVEL \
        -Q $QUEUES \
        -c $CONCURRENCY \
        --pool=threads
fi
