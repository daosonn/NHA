"""Client OpenAI — Structured Outputs (json_schema strict) như demo onemoretime.

Mọi call đi qua đây: một chỗ duy nhất giữ API key, retry, và chuyển mock.
Trả pydantic model đã validate — route không bao giờ phải tự parse JSON.
"""

import json
import logging
import time
from typing import TypeVar

from openai import OpenAI
from pydantic import BaseModel

from .config import settings

T = TypeVar("T", bound=BaseModel)

# "uvicorn.error" là logger DUY NHẤT chắc chắn có handler khi chạy dưới uvicorn;
# một logger riêng (nha.ai) không propagate được và log bay vào hư không.
log = logging.getLogger("uvicorn.error")

_client: OpenAI | None = None


def client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings().openai_api_key)
    return _client


def chat_json(
    model: str,
    system: str,
    user: str,
    response_model: type[T],
    *,
    image_b64: str | None = None,
    images_b64: list[str] | None = None,
    max_output_tokens: int = 8192,
    feature: str = "call",
) -> T:
    """Gọi chat.completions với json_schema strict từ pydantic model, validate rồi trả về.

    Nhiều ảnh gửi trong MỘT call (detail="low", ~85 token/ảnh): một bài đăng là một
    sự kiện, tách thành nhiều call thì model mất mạch chuyện giữa các ảnh.
    """
    schema = response_model.model_json_schema()
    # OpenAI strict mode: mọi object cần additionalProperties=false
    _strictify(schema)
    images = [*(images_b64 or []), *([image_b64] if image_b64 else [])]
    content: list[dict] | str
    if images:
        content = [
            {"type": "text", "text": user},
            *(
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b}", "detail": "low"}}
                for b in images
            ),
        ]
    else:
        content = user
    started = time.monotonic()
    rsp = client().chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": content}],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": response_model.__name__, "strict": True, "schema": schema},
        },
        # Chặn trần đầu ra (giống demo): một lần sinh trôi dài là người dùng ngồi chờ.
        max_completion_tokens=max_output_tokens,
    )
    # Log thời gian + token: độ trễ người dùng thấy gần như bằng đúng call này, nên
    # phải đo được mà không cần dựng lại thí nghiệm (out token là thứ chi phối).
    usage = rsp.usage
    log.info(
        "%s %s %.1fs in=%s out=%s",
        feature,
        model,
        time.monotonic() - started,
        getattr(usage, "prompt_tokens", "?"),
        getattr(usage, "completion_tokens", "?"),
    )
    raw = rsp.choices[0].message.content or "{}"
    return response_model.model_validate(json.loads(raw))


def _strictify(schema: dict) -> None:
    """Đệ quy: object → additionalProperties false + required đủ mọi key (yêu cầu strict mode)."""
    if schema.get("type") == "object" or "properties" in schema:
        schema["additionalProperties"] = False
        props = schema.get("properties", {})
        schema["required"] = list(props.keys())
        for v in props.values():
            _strictify(v)
    for key in ("items",):
        if key in schema and isinstance(schema[key], dict):
            _strictify(schema[key])
    for key in ("anyOf", "allOf", "oneOf"):
        for sub in schema.get(key, []) or []:
            _strictify(sub)
    for sub in (schema.get("$defs") or {}).values():
        _strictify(sub)
