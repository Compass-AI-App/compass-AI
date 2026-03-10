"""Provider-agnostic LLM orchestrator.

Routes LLM calls through a configurable provider (Anthropic direct, Compass Cloud,
or BYOK), tracks token usage per-session, and returns responses in a unified format.
"""

from __future__ import annotations

import json
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Generator

logger = logging.getLogger(__name__)


@dataclass
class TokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def total(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def estimated_cost_usd(self) -> float:
        return (self.input_tokens * 3.0 + self.output_tokens * 15.0) / 1_000_000

    def record(self, input_t: int, output_t: int) -> None:
        self.input_tokens += input_t
        self.output_tokens += output_t

    def to_dict(self) -> dict:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total,
            "estimated_cost_usd": round(self.estimated_cost_usd, 4),
        }


class LLMProvider(ABC):
    """Abstract base for LLM providers."""

    @abstractmethod
    def complete(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
    ) -> tuple[str, int, int]:
        """Returns (response_text, input_tokens, output_tokens)."""
        ...

    def complete_stream(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
    ) -> Generator[str, None, tuple[int, int]]:
        """Streaming variant. Yields tokens, returns (input_tokens, output_tokens)."""
        text, inp, out = self.complete(prompt, system, model, max_tokens)
        yield text
        return (inp, out)


class AnthropicProvider(LLMProvider):
    """Direct Anthropic API calls."""

    DEFAULT_MODEL = "claude-sonnet-4-20250514"

    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        from anthropic import Anthropic

        key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if not key:
            from dotenv import load_dotenv

            load_dotenv()
            key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not key:
            raise ValueError("ANTHROPIC_API_KEY not set.")

        url = base_url or os.environ.get("ANTHROPIC_BASE_URL", "")
        kwargs: dict = {"api_key": key}
        if url:
            kwargs["base_url"] = url
        self._client = Anthropic(**kwargs)

    def complete(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
    ) -> tuple[str, int, int]:
        model = model or self.DEFAULT_MODEL
        response = self._client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system or "You are Compass, an AI product discovery assistant.",
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text
        inp = response.usage.input_tokens
        out = response.usage.output_tokens
        return text, inp, out

    def complete_stream(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
    ) -> Generator[str, None, tuple[int, int]]:
        model = model or self.DEFAULT_MODEL
        with self._client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            system=system or "You are Compass, an AI product discovery assistant.",
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                yield text
            msg = stream.get_final_message()
            return (msg.usage.input_tokens, msg.usage.output_tokens)


class TaskforceProvider(LLMProvider):
    """Routes calls through Spotify's Taskforce/Hendrix GenAI gateway (OpenAI-compatible)."""

    DEFAULT_MODEL = "claude-sonnet-4-5"
    BASE_URL = "https://hendrix-genai.spotify.net/taskforce/anthropic/v1"

    # Anthropic SDK model IDs → Taskforce model names
    _MODEL_MAP = {
        "claude-sonnet-4-20250514": "claude-sonnet-4-5",
        "claude-opus-4-20250514": "claude-opus-4-5",
        "claude-haiku-4-20250514": "claude-haiku-4-5",
    }

    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key or os.environ.get("TASKFORCE_API_KEY", "")
        if not self.api_key:
            raise ValueError("TASKFORCE_API_KEY not set.")
        self.base_url = (base_url or os.environ.get("TASKFORCE_BASE_URL", "")).rstrip("/") or self.BASE_URL

    def _resolve_model(self, model: str) -> str:
        """Translate Anthropic model IDs to Taskforce-compatible names."""
        return self._MODEL_MAP.get(model, model) if model else self.DEFAULT_MODEL

    def complete(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
    ) -> tuple[str, int, int]:
        import urllib.request
        import urllib.error

        url = f"{self.base_url}/chat/completions"
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        else:
            messages.append({"role": "system", "content": "You are Compass, an AI product discovery assistant."})
        messages.append({"role": "user", "content": prompt})

        payload = json.dumps({
            "model": self._resolve_model(model),
            "max_tokens": max_tokens,
            "messages": messages,
        }).encode()

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "apikey": self.api_key,
            },
            method="POST",
        )

        last_error: Exception | None = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    data = json.loads(resp.read().decode())
                    text = data["choices"][0]["message"]["content"]
                    usage = data.get("usage", {})
                    inp = usage.get("prompt_tokens", 0)
                    out = usage.get("completion_tokens", 0)
                    return text, inp, out
            except urllib.error.HTTPError as e:
                body = e.read().decode() if e.fp else ""
                if 400 <= e.code < 500:
                    raise RuntimeError(f"Taskforce error ({e.code}): {body}") from e
                last_error = RuntimeError(f"Taskforce error ({e.code}): {body}")
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last_error = RuntimeError(f"Taskforce connection error: {e}")

            if attempt < 2:
                wait = 2 ** attempt
                logger.warning("Taskforce request failed (attempt %d/3), retrying in %ds...", attempt + 1, wait)
                time.sleep(wait)

        raise last_error  # type: ignore[misc]


class CompassCloudProvider(LLMProvider):
    """Proxies calls through Compass Cloud API (auth + metering)."""

    def __init__(self, cloud_url: str = "", auth_token: str = ""):
        self.cloud_url = cloud_url or os.environ.get("COMPASS_CLOUD_URL", "https://api.compass.dev")
        self.auth_token = auth_token or os.environ.get("COMPASS_AUTH_TOKEN", "")

    def complete(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
    ) -> tuple[str, int, int]:
        import urllib.request
        import urllib.error

        if not self.auth_token:
            raise ValueError(
                "Compass Cloud auth token not set. "
                "Run 'compass login' or set COMPASS_AUTH_TOKEN."
            )

        url = f"{self.cloud_url.rstrip('/')}/proxy/complete"
        payload = json.dumps({
            "prompt": prompt,
            "system": system,
            "model": model or "claude-sonnet-4-20250514",
            "max_tokens": max_tokens,
        }).encode()

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.auth_token}",
            },
            method="POST",
        )

        last_error: Exception | None = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    data = json.loads(resp.read().decode())
                    return (
                        data["content"],
                        data.get("input_tokens", 0),
                        data.get("output_tokens", 0),
                    )
            except urllib.error.HTTPError as e:
                body = e.read().decode() if e.fp else ""
                # Don't retry client errors (4xx)
                if 400 <= e.code < 500:
                    raise RuntimeError(f"Compass Cloud error ({e.code}): {body}") from e
                last_error = RuntimeError(f"Compass Cloud error ({e.code}): {body}")
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last_error = RuntimeError(f"Compass Cloud connection error: {e}")

            if attempt < 2:
                wait = 2 ** attempt
                logger.warning("Compass Cloud request failed (attempt %d/3), retrying in %ds...", attempt + 1, wait)
                time.sleep(wait)

        raise last_error  # type: ignore[misc]


class Orchestrator:
    """Central LLM orchestrator — manages provider, tracks usage."""

    def __init__(self, provider: LLMProvider | None = None, default_model: str = ""):
        self.provider = provider or _create_default_provider()
        self.default_model = default_model
        self.usage = TokenUsage()

    def ask(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
    ) -> str:
        text, inp, out = self.provider.complete(
            prompt, system, model or self.default_model, max_tokens
        )
        self.usage.record(inp, out)
        return text

    def ask_json(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
    ) -> dict | list:
        full_prompt = prompt + "\n\nRespond with valid JSON only. No markdown fences, no explanation."
        text = self.ask(full_prompt, system, model, max_tokens)

        return _extract_json(text)


def _extract_json(text: str) -> dict | list:
    """Extract JSON from LLM output, handling markdown fences and trailing text."""
    cleaned = text.strip()

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove opening fence line
        lines = lines[1:]
        # Remove closing fence if present
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to find JSON object or array within the text
    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start = cleaned.find(start_char)
        if start == -1:
            continue
        # Find the matching closing bracket from the end
        end = cleaned.rfind(end_char)
        if end <= start:
            continue
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            continue

    raise json.JSONDecodeError(
        f"Could not extract valid JSON from LLM response (first 200 chars): {text[:200]}",
        text,
        0,
    )

    def ask_stream(
        self,
        prompt: str,
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
    ) -> Generator[str, None, None]:
        gen = self.provider.complete_stream(
            prompt, system, model or self.default_model, max_tokens
        )
        try:
            while True:
                yield next(gen)
        except StopIteration as e:
            if e.value:
                inp, out = e.value
                self.usage.record(inp, out)


_instance: Orchestrator | None = None


def get_orchestrator() -> Orchestrator:
    """Get or create the global orchestrator singleton."""
    global _instance
    if _instance is None:
        _instance = Orchestrator()
    return _instance


def configure_orchestrator(
    api_key: str = "",
    model: str = "",
    provider: str = "anthropic",
    base_url: str = "",
) -> Orchestrator:
    """Reconfigure the global orchestrator with new settings.

    Preserves existing TokenUsage across reconfiguration so session
    totals aren't lost when the user changes settings mid-session.
    """
    global _instance

    # Preserve existing usage if we're reconfiguring
    existing_usage = _instance.usage if _instance else TokenUsage()

    if provider == "cloud":
        llm_provider = CompassCloudProvider()
    elif provider == "taskforce":
        llm_provider = TaskforceProvider(api_key=api_key or None, base_url=base_url or None)
    else:
        llm_provider = AnthropicProvider(api_key=api_key or None, base_url=base_url or None)

    _instance = Orchestrator(provider=llm_provider, default_model=model)
    _instance.usage = existing_usage
    return _instance


def reset_orchestrator() -> None:
    global _instance
    _instance = None


def _create_default_provider() -> LLMProvider:
    # Load .env early so COMPASS_LLM_PROVIDER and keys are available
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    provider_name = os.environ.get("COMPASS_LLM_PROVIDER", "anthropic").lower()
    if provider_name == "cloud":
        return CompassCloudProvider()
    if provider_name == "taskforce":
        return TaskforceProvider()
    return AnthropicProvider()
