"""
Worker-specific exceptions.
"""


class WorkerError(Exception):
    """Base worker error."""
    pass


class PreviewExecutionError(WorkerError):
    """Error during preview SQL execution."""
    pass


class ConnectionError(WorkerError):
    """Database connection error."""
    pass


class ValidationError(WorkerError):
    """SQL validation error."""
    pass


class TaskTimeoutError(WorkerError):
    """Task exceeded time limit."""
    pass
