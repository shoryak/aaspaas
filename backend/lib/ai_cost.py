"""Estimated Vertex AI spend per discovery. Rates are list prices (USD per 1M tokens) and can be overridden via env."""
import os

INPUT_USD_PER_M = float(os.environ.get("VERTEX_INPUT_USD_PER_M", "0.30"))
OUTPUT_USD_PER_M = float(os.environ.get("VERTEX_OUTPUT_USD_PER_M", "2.50"))
# Used only for AI ideas created before token usage was recorded and no measured average exists yet.
DEFAULT_IDEA_USD = 1500 * INPUT_USD_PER_M / 1e6 + 3500 * OUTPUT_USD_PER_M / 1e6


def ai_cost_usd(usage: dict | None) -> float:
    if not usage:
        return 0.0
    return round(usage.get("input_tokens", 0) * INPUT_USD_PER_M / 1e6 + usage.get("output_tokens", 0) * OUTPUT_USD_PER_M / 1e6, 6)
