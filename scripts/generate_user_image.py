#!/usr/bin/env python3
"""
Generate an image from a text prompt using the Google Genai SDK.
Custom function generate_image_direct(prompt) — bypasses built-in image tool.
Uses model gemini-2.5-flash-image and response_modalities including IMAGE (TEXT required by API).
API key: REACT_APP_GEMINI_API_KEY from .env (passed by server).
"""
import os
import sys
import base64
from datetime import datetime

# Primary model for image gen; fallback if not available on this API key (e.g. Google AI Studio)
IMAGE_MODEL = "gemini-2.5-flash-image"
IMAGE_MODEL_FALLBACK = "gemini-2.0-flash-exp"


def generate_image_direct(prompt: str) -> dict:
    """
    Custom image generation: sends the user's dynamic prompt to the API,
    configures response_modalities to include IMAGE, extracts image data and saves to a file.
    Returns dict: {"ok": True, "path": "...", "base64": "..."} or {"ok": False, "error": "..."}.
    """
    try:
        from google import genai
        from google.genai import types
        Modality = getattr(types, "Modality", None)
    except ImportError:
        return {"ok": False, "error": "google-genai not installed. Run: pip install google-genai"}

    api_key = os.environ.get("REACT_APP_GEMINI_API_KEY")
    if not api_key:
        return {"ok": False, "error": "API key not set. Set REACT_APP_GEMINI_API_KEY in .env"}

    if not prompt or not str(prompt).strip():
        return {"ok": False, "error": "Prompt is required"}

    client = genai.Client(api_key=api_key)
    modalities = [Modality.TEXT, Modality.IMAGE] if Modality else ["TEXT", "IMAGE"]
    response = None
    for model in (IMAGE_MODEL, IMAGE_MODEL_FALLBACK):
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt.strip(),
                config=types.GenerateContentConfig(
                    response_modalities=modalities,
                ),
            )
            break
        except Exception as e:
            err = str(e).lower()
            if "404" in err or "not found" in err or "invalid" in err or "model" in err:
                if model == IMAGE_MODEL_FALLBACK:
                    return {"ok": False, "error": str(e)}
                continue
            return {"ok": False, "error": str(e)}
    if response is None:
        return {"ok": False, "error": "No image model available"}

    # Extract image from response (support both dict and object-style parts)
    image_data = None
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return {"ok": False, "error": "No candidates in response"}
    content = getattr(candidates[0], "content", None) or candidates[0].get("content") if isinstance(candidates[0], dict) else None
    if not content:
        return {"ok": False, "error": "No content in candidate"}
    parts = getattr(content, "parts", None) or (content.get("parts") if isinstance(content, dict) else []) or []
    for part in parts:
        inline = getattr(part, "inline_data", None) or (part.get("inline_data") if isinstance(part, dict) else None)
        if inline:
            image_data = getattr(inline, "data", None) or (inline.get("data") if isinstance(inline, dict) else None)
            if image_data:
                break

    if not image_data:
        return {"ok": False, "error": "No image in model response"}

    if isinstance(image_data, str):
        image_data = base64.b64decode(image_data)
    elif not isinstance(image_data, bytes):
        image_data = bytes(image_data)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"output_{timestamp}.png"
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(script_dir, "..", "server", "generated_images")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, filename)

    with open(path, "wb") as f:
        f.write(image_data)

    b64 = base64.b64encode(image_data).decode("ascii")
    return {"ok": True, "path": path, "base64": b64}


def generate_user_image(prompt: str) -> dict:
    """Alias so existing callers still work; delegates to generate_image_direct."""
    return generate_image_direct(prompt)


def main():
    import json
    try:
        prompt = os.environ.get("IMAGE_PROMPT", "").strip()
        if not prompt and len(sys.argv) >= 2:
            prompt = " ".join(sys.argv[1:])
        if not prompt:
            print(json.dumps({"ok": False, "error": "No prompt (set IMAGE_PROMPT or pass as args)"}))
            sys.exit(1)
        result = generate_image_direct(prompt)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
