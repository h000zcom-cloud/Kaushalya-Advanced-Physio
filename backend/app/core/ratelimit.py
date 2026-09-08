from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)


async def rate_limit_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=429, content={"detail": "Too many requests. Please wait a moment and try again.", "code": "rate_limited"})
