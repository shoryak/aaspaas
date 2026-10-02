"""Shared Vertex AI (Gemini) JSON generation used by discovery and the peer backfill."""
import json
import os
import re

from google import genai
from google.genai import types
from google.oauth2 import service_account
from pydantic import BaseModel


def vertex_configured() -> bool:
    return bool(os.environ.get("GCP_SERVICE_ACCOUNT_JSON") and os.environ.get("GCP_PROJECT_ID"))


def json_from_text(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).replace("```", "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("LLM did not return JSON")
    return json.loads(cleaned[start : end + 1])


async def generate_json(system: str, prompt: str, schema: type[BaseModel], max_output_tokens: int = 12000) -> tuple[dict, dict | None]:
    """Stream one structured Gemini answer. Raises when Vertex is unconfigured or the call fails."""
    if not vertex_configured():
        raise RuntimeError("Vertex AI is not configured")
    credentials = service_account.Credentials.from_service_account_info(
        json.loads(os.environ["GCP_SERVICE_ACCOUNT_JSON"]), scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    client = genai.Client(
        vertexai=True, project=os.environ["GCP_PROJECT_ID"], location=os.environ.get("VERTEX_LOCATION", "us-central1"),
        credentials=credentials, http_options=types.HttpOptions(api_version="v1"),
    )
    chunks: list[str] = []
    usage = None
    try:
        stream = await client.aio.models.generate_content_stream(
            model=os.environ.get("VERTEX_MODEL", "gemini-2.5-flash"), contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system, temperature=0.2, max_output_tokens=max_output_tokens,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                response_mime_type="application/json", response_schema=schema,
            ),
        )
        async for chunk in stream:
            if chunk.text:
                chunks.append(chunk.text)
            if chunk.usage_metadata:
                usage = chunk.usage_metadata
    finally:
        await client.aio.aclose()
    token_usage = None
    if usage is not None:
        token_usage = {
            "input_tokens": usage.prompt_token_count or 0,
            "output_tokens": (usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0),
        }
    return json_from_text("".join(chunks)), token_usage
