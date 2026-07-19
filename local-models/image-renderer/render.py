from __future__ import annotations

import argparse
import hashlib
import os
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


def read_prompt(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def seed_to_int(seed: str) -> int:
    return int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16], 16) % (2**31)


def mix(a: int, b: int, amount: float) -> int:
    return max(0, min(255, round(a * (1 - amount) + b * amount)))


def color_mix(base: tuple[int, int, int], target: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(mix(base[i], target[i], amount) for i in range(3))


def ellipse_gradient(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    base: tuple[int, int, int],
    light: tuple[int, int, int],
    shadow: tuple[int, int, int],
    steps: int = 34,
) -> None:
    left, top, right, bottom = box
    for step in range(steps, 0, -1):
        t = step / steps
        inset_x = (right - left) * (1 - t) / 2
        inset_y = (bottom - top) * (1 - t) / 2
        tone = color_mix(shadow, base, t)
        draw.ellipse((left + inset_x, top + inset_y, right - inset_x, bottom - inset_y), fill=(*tone, 255))
    highlight = (
        left + (right - left) * 0.2,
        top + (bottom - top) * 0.18,
        left + (right - left) * 0.56,
        top + (bottom - top) * 0.52,
    )
    draw.ellipse(highlight, fill=(*light, 42))


def draw_screen(draw: ImageDraw.ImageDraw, rng: random.Random, x: float, y: float, w: float, h: float) -> None:
    draw.rounded_rectangle((x + w * 0.015, y + h * 0.02, x + w * 1.015, y + h * 1.02), radius=max(8, int(w * 0.025)), fill=(0, 8, 18, 110))
    draw.rounded_rectangle((x, y, x + w, y + h), radius=max(8, int(w * 0.025)), fill=(5, 22, 38, 242), outline=(79, 197, 231, 108), width=max(2, int(w * 0.008)))
    draw.rectangle((x + w * 0.05, y + h * 0.08, x + w * 0.95, y + h * 0.84), fill=(13, 83, 113, 236))
    draw.polygon(
        [(x + w * 0.05, y + h * 0.08), (x + w * 0.95, y + h * 0.08), (x + w * 0.62, y + h * 0.84), (x + w * 0.05, y + h * 0.84)],
        fill=(255, 255, 255, 18),
    )
    for index in range(12):
        yy = y + h * (0.16 + index * 0.052)
        end = x + w * (0.26 + rng.random() * 0.58)
        draw.line((x + w * 0.08, yy, end, yy), fill=(152, 234, 255, 116), width=max(1, int(w * 0.006)))
    for index in range(8):
        bx = x + w * (0.09 + index * 0.095)
        bh = h * (0.12 + rng.random() * 0.42)
        draw.rounded_rectangle((bx, y + h * 0.74 - bh, bx + w * 0.035, y + h * 0.74), radius=2, fill=(61, 213, 246, 150))


def draw_person(
    layer: Image.Image,
    rng: random.Random,
    cx: float,
    base: float,
    scale: float,
    skin: tuple[int, int, int],
    jacket: tuple[int, int, int],
    pose: float,
) -> None:
    draw = ImageDraw.Draw(layer, "RGBA")
    light = color_mix(skin, (255, 235, 210), 0.38)
    shadow = color_mix(skin, (38, 22, 22), 0.45)
    deep_shadow = color_mix(skin, (12, 10, 12), 0.62)
    head_w = 52 * scale
    head_h = 68 * scale
    head_y = base - 178 * scale
    shoulder = 84 * scale
    torso_top = base - 116 * scale

    draw.ellipse((cx - 82 * scale, base - 6 * scale, cx + 82 * scale, base + 22 * scale), fill=(0, 8, 17, 116))
    draw.line((cx - 46 * scale, torso_top + 26 * scale, cx - 88 * scale, torso_top + 88 * scale + pose), fill=(*jacket, 245), width=max(8, int(16 * scale)))
    draw.line((cx + 46 * scale, torso_top + 24 * scale, cx + 88 * scale, torso_top + 80 * scale - pose), fill=(*jacket, 245), width=max(8, int(16 * scale)))
    draw.line((cx - 88 * scale, torso_top + 88 * scale + pose, cx - 54 * scale, torso_top + 110 * scale), fill=(*skin, 238), width=max(5, int(10 * scale)))
    draw.line((cx + 88 * scale, torso_top + 80 * scale - pose, cx + 112 * scale, torso_top + 58 * scale), fill=(*skin, 238), width=max(5, int(10 * scale)))
    draw.ellipse((cx - 62 * scale, torso_top + 102 * scale, cx - 44 * scale, torso_top + 120 * scale), fill=(*light, 225))
    draw.ellipse((cx + 102 * scale, torso_top + 49 * scale, cx + 120 * scale, torso_top + 67 * scale), fill=(*light, 225))

    torso = (
        cx - shoulder,
        torso_top,
        cx + shoulder,
        base + 10 * scale,
    )
    draw.rounded_rectangle(torso, radius=max(18, int(35 * scale)), fill=(*color_mix(jacket, (0, 0, 0), 0.12), 252))
    draw.rounded_rectangle(
        (cx - shoulder * 0.92, torso_top + 8 * scale, cx + shoulder * 0.92, base + 5 * scale),
        radius=max(16, int(30 * scale)),
        outline=(*color_mix(jacket, (255, 255, 255), 0.28), 64),
        width=max(1, int(2 * scale)),
    )
    draw.polygon(
        [(cx - shoulder * 0.72, torso_top + 8 * scale), (cx - 18 * scale, torso_top + 34 * scale), (cx - 28 * scale, base - 24 * scale)],
        fill=(*color_mix(jacket, (255, 255, 255), 0.14), 110),
    )
    draw.polygon(
        [(cx + shoulder * 0.72, torso_top + 8 * scale), (cx + 18 * scale, torso_top + 34 * scale), (cx + 28 * scale, base - 24 * scale)],
        fill=(*color_mix(jacket, (0, 0, 0), 0.16), 120),
    )
    draw.polygon(
        [
            (cx - 18 * scale, torso_top + 10 * scale),
            (cx + 18 * scale, torso_top + 10 * scale),
            (cx + 26 * scale, base - 28 * scale),
            (cx - 26 * scale, base - 28 * scale),
        ],
        fill=(231, 238, 244, 238),
    )
    tie = (64, 205, 240) if rng.random() > 0.5 else (124, 96, 255)
    draw.polygon(
        [
            (cx, torso_top + 18 * scale),
            (cx + 10 * scale, torso_top + 48 * scale),
            (cx + 4 * scale, base - 36 * scale),
            (cx - 4 * scale, base - 36 * scale),
            (cx - 10 * scale, torso_top + 48 * scale),
        ],
        fill=(*tie, 230),
    )

    draw.rectangle((cx - 16 * scale, head_y + head_h * 0.42, cx + 16 * scale, torso_top + 24 * scale), fill=(*skin, 255))
    ellipse_gradient(draw, (cx - head_w / 2, head_y, cx + head_w / 2, head_y + head_h), skin, light, shadow)
    draw.ellipse((cx - head_w * 0.38, head_y + head_h * 0.36, cx - head_w * 0.08, head_y + head_h * 0.58), fill=(*color_mix(light, skin, 0.25), 40))
    draw.ellipse((cx + head_w * 0.1, head_y + head_h * 0.42, cx + head_w * 0.42, head_y + head_h * 0.66), fill=(*deep_shadow, 34))
    hair = (29, 23, 27)
    draw.ellipse((cx - head_w * 0.54, head_y - head_h * 0.08, cx + head_w * 0.54, head_y + head_h * 0.32), fill=(*hair, 248))
    draw.ellipse((cx - head_w * 0.56, head_y + head_h * 0.16, cx - head_w * 0.28, head_y + head_h * 0.58), fill=(*hair, 232))
    draw.ellipse((cx + head_w * 0.28, head_y + head_h * 0.18, cx + head_w * 0.54, head_y + head_h * 0.56), fill=(*hair, 222))
    eye_y = head_y + head_h * 0.48
    for side in (-1, 1):
        draw.arc((cx + side * 13 * scale - 7 * scale, eye_y - 8 * scale, cx + side * 13 * scale + 7 * scale, eye_y + 2 * scale), 190, 350, fill=(20, 13, 15, 156), width=max(1, int(1.6 * scale)))
        draw.ellipse((cx + side * 13 * scale - 2.4 * scale, eye_y - 2.2 * scale, cx + side * 13 * scale + 2.4 * scale, eye_y + 2.2 * scale), fill=(4, 12, 20, 235))
    draw.line((cx + 2 * scale, head_y + head_h * 0.5, cx - 2 * scale, head_y + head_h * 0.62), fill=(*shadow, 100), width=max(1, int(1.4 * scale)))
    draw.ellipse((cx - 3 * scale, head_y + head_h * 0.62, cx + 5 * scale, head_y + head_h * 0.67), fill=(*color_mix(shadow, skin, 0.2), 70))
    draw.arc((cx - 15 * scale, head_y + head_h * 0.6, cx + 15 * scale, head_y + head_h * 0.82), start=12, end=168, fill=(118, 48, 49, 190), width=max(1, int(2 * scale)))
    draw.line((cx - 22 * scale, base - 2 * scale, cx - 34 * scale, base + 46 * scale), fill=(13, 25, 43, 245), width=max(7, int(13 * scale)))
    draw.line((cx + 22 * scale, base - 2 * scale, cx + 35 * scale, base + 46 * scale), fill=(13, 25, 43, 245), width=max(7, int(13 * scale)))
    draw.line((cx - 20 * scale, base + 39 * scale, cx - 48 * scale, base + 39 * scale), fill=(4, 10, 18, 210), width=max(5, int(8 * scale)))
    draw.line((cx + 28 * scale, base + 39 * scale, cx + 55 * scale, base + 39 * scale), fill=(4, 10, 18, 210), width=max(5, int(8 * scale)))


def fallback_image(prompt: str, output: Path, width: int, height: int, seed: str) -> None:
    """Last-resort independent 3D-style bitmap; never calls a hosted service."""
    rng = random.Random(seed_to_int(prompt + seed))
    scale = 2
    w = width * scale
    h = height * scale
    image = Image.new("RGB", (w, h), (8, 15, 27))
    draw = ImageDraw.Draw(image, "RGBA")

    for y in range(h):
        v = y / max(1, h - 1)
        glow = max(0.0, 1.0 - abs(v - 0.36) * 2.25)
        red = int(8 + 38 * v + 24 * glow)
        green = int(18 + 54 * v + 58 * glow)
        blue = int(42 + 72 * (1 - v) + 78 * glow)
        draw.line((0, y, w, y), fill=(red, green, blue, 255))

    for _ in range(180):
        x = rng.randint(0, w)
        y = rng.randint(0, h)
        r = rng.randint(8, 58)
        color = rng.choice([(50, 205, 240), (126, 98, 255), (101, 255, 201)])
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(*color, rng.randint(12, 38)))

    draw.polygon([(0, h * 0.72), (w, h * 0.56), (w, h), (0, h)], fill=(16, 31, 43, 190))
    for index in range(18):
        x = w * (-0.08 + index * 0.075)
        draw.line((x, h, x + w * 0.26, h * 0.62), fill=(132, 180, 196, 34), width=max(1, int(2 * scale)))

    draw_screen(draw, rng, w * 0.09, h * 0.13, w * 0.25, h * 0.24)
    draw_screen(draw, rng, w * 0.56, h * 0.11, w * 0.34, h * 0.28)
    draw_screen(draw, rng, w * 0.77, h * 0.58, w * 0.13, h * 0.15)
    draw.rounded_rectangle((w * 0.22, h * 0.68, w * 0.78, h * 0.74), radius=14 * scale, fill=(8, 19, 30, 220))
    for index in range(6):
        x = w * (0.22 + index * 0.102)
        draw.rounded_rectangle((x, h * 0.55, x + w * 0.025, h * 0.69), radius=4 * scale, fill=(88, 111, 122, 136))

    skins = [(86, 52, 39), (147, 90, 62), (196, 136, 91), (119, 76, 54)]
    jackets = [(20, 39, 66), (31, 55, 96), (22, 79, 92), (54, 46, 90)]
    draw_person(image, rng, w * 0.36, h * 0.76, 1.04 * scale, skins[rng.randrange(len(skins))], jackets[rng.randrange(len(jackets))], rng.randint(-8, 8) * scale)
    draw_person(image, rng, w * 0.53, h * 0.75, 1.15 * scale, skins[rng.randrange(len(skins))], jackets[rng.randrange(len(jackets))], rng.randint(-8, 8) * scale)
    draw_person(image, rng, w * 0.69, h * 0.77, 0.98 * scale, skins[rng.randrange(len(skins))], jackets[rng.randrange(len(jackets))], rng.randint(-8, 8) * scale)

    for index in range(14):
        angle = -2.55 + index * 0.36
        radius = w * (0.18 + rng.random() * 0.02)
        x = w * 0.54 + radius * __import__("math").cos(angle)
        y = h * 0.5 + radius * 0.42 * __import__("math").sin(angle)
        draw.ellipse((x - 6 * scale, y - 6 * scale, x + 6 * scale, y + 6 * scale), fill=(75, 221, 247, 188))
        if index:
            draw.line((last_x, last_y, x, y), fill=(75, 221, 247, 92), width=max(1, int(2 * scale)))
        last_x, last_y = x, y

    grain = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    grain_draw = ImageDraw.Draw(grain, "RGBA")
    for _ in range(max(1200, width * height // 220)):
        x = rng.randrange(w)
        y = rng.randrange(h)
        value = rng.randrange(10, 48)
        grain_draw.point((x, y), fill=(value, value, value, rng.randrange(18, 46)))
    image = Image.alpha_composite(image.convert("RGBA"), grain).filter(ImageFilter.UnsharpMask(radius=1.2, percent=105, threshold=3))
    image = image.resize((width, height), Image.Resampling.LANCZOS).convert("RGB")
    image.save(output)


def diffusion_dimensions(target_width: int, target_height: int) -> tuple[int, int]:
    device = os.environ.get("CACSMS_LOCAL_IMAGE_DEVICE", "cpu")
    family = resolve_model_family(os.environ.get("CACSMS_LOCAL_IMAGE_MODEL_ID", ""))
    cpu_default = "768" if family == "sdxl" else "512"
    max_width = int(os.environ.get("CACSMS_LOCAL_IMAGE_MAX_DIFFUSION_WIDTH", cpu_default))
    max_height = int(os.environ.get("CACSMS_LOCAL_IMAGE_MAX_DIFFUSION_HEIGHT", cpu_default))
    scale = min(1.0, max_width / max(target_width, 1), max_height / max(target_height, 1))
    width = max(256, int((target_width * scale) // 8) * 8)
    height = max(256, int((target_height * scale) // 8) * 8)
    return width, height


def resolve_model_family(model_id: str) -> str:
    explicit = os.environ.get("CACSMS_LOCAL_IMAGE_MODEL_FAMILY", "").strip().lower()
    if explicit in {"sdxl", "xl"}:
        return "sdxl"
    if explicit in {"sd15", "sd1.5", "sd1", "1.5"}:
        return "sd15"
    lowered = model_id.lower()
    if any(marker in lowered for marker in ("sdxl", "realvisxl", "juggernautxl", "dreamshaperxl", "/xl/", "_xl")):
        return "sdxl"
    return "sd15"


def configure_offline_mode() -> None:
    if os.environ.get("CACSMS_LOCAL_IMAGE_OFFLINE") == "1":
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"


def build_diffusion_prompts(prompt: str) -> tuple[str, str]:
    prompt_head = prompt.split("Negative prompt:", 1)[0]
    prompt_head = " ".join(prompt_head.replace("\n", " ").split())
    locale_bits = []
    for marker in ("Locale:", "Regional realism:", "Language/signage/currency constraints:", "Cultural integrity:"):
        if marker in prompt_head:
            segment = prompt_head.split(marker, 1)[1].split(".", 2)[0]
            locale_bits.append(f"{marker} {segment}".strip())
    if len(prompt_head) > 620:
        prompt_head = prompt_head[:620].rsplit(" ", 1)[0]
    enhanced = (
        "photorealistic documentary photograph, ultra-sharp natural human faces as the primary focal priority, "
        "one or two Black Nigerian West African business professionals in foreground with large readable faces, "
        "symmetrical natural face structure, detailed eyes with visible pupils and catchlights, natural skin pores and texture, "
        "unique original synthetic identity per person, no celebrity likeness, no duplicated faces, "
        "natural nose, lips, ears and jawline without distortion, complete head visible with headroom, "
        "visible hands with five distinct fingers when hands appear, correct hand anatomy, "
        "contemporary Lagos Nigerian corporate technology workplace, AI shown only as software dashboards on screens, "
        "medium-wide 35mm documentary camera, moderate depth of field with sharp facial detail on subjects, "
        f"{' '.join(locale_bits)} {prompt_head}"
    )
    negative = (
        "deformed face, disfigured face, ugly face, bad face, melted face, smudged face, blurry face, "
        "asymmetric eyes, cross-eyed, lazy eye, mismatched eyes, distorted eyes, dead eyes, "
        "plastic skin, waxy skin, doll face, mannequin face, fake face, ai generated face, "
        "cartoon, illustration, icon, flat vector, anime, painting, sketch, "
        "malformed hands, fused fingers, extra fingers, missing fingers, mutated hands, bad anatomy, "
        "watermark, logo, text, low quality, soft focus, "
        "cyborg, robot, mechanical face, cybernetic implant, sci-fi face, "
        "face mask, masked face, helmet, visor, "
        "celebrity likeness, duplicated face, cloned face, "
        "traditional costume, ceremonial attire, head wrap, "
        "generic western office portrait, passport photo, beauty portrait, extreme close-up"
    )
    if "Negative prompt:" in prompt:
        supplied = prompt.split("Negative prompt:", 1)[1].strip()
        if supplied:
            negative = f"{negative}, {supplied}"
    return enhanced, negative


_pipeline = None


def load_diffusion_pipeline(force_reload: bool = False):
    global _pipeline
    if _pipeline is not None and not force_reload:
        return _pipeline

    model_id = os.environ.get("CACSMS_LOCAL_IMAGE_MODEL_ID", "").strip()
    if not model_id:
        raise RuntimeError("CACSMS_LOCAL_IMAGE_MODEL_ID is not set.")

    import torch
    from diffusers import AutoPipelineForText2Image, DPMSolverMultistepScheduler, StableDiffusionPipeline, StableDiffusionXLPipeline

    configure_offline_mode()
    device = os.environ.get("CACSMS_LOCAL_IMAGE_DEVICE", "cpu")
    local_files_only = os.environ.get("CACSMS_LOCAL_IMAGE_OFFLINE") == "1" or Path(model_id).exists()
    family = resolve_model_family(model_id)

    model_path = Path(model_id)
    if model_path.is_file() and model_path.suffix.lower() in {".safetensors", ".ckpt"}:
        loader = StableDiffusionXLPipeline if family == "sdxl" else StableDiffusionPipeline
        pipe = loader.from_single_file(
            str(model_path),
            torch_dtype=torch.float32,
            local_files_only=local_files_only,
            safety_checker=None,
            requires_safety_checker=False,
        )
    else:
        loader = AutoPipelineForText2Image
        try:
            pipe = loader.from_pretrained(
                model_id,
                torch_dtype=torch.float32,
                local_files_only=local_files_only,
                safety_checker=None,
                requires_safety_checker=False,
            )
        except Exception:
            fallback_loader = StableDiffusionXLPipeline if family == "sdxl" else StableDiffusionPipeline
            pipe = fallback_loader.from_pretrained(
                model_id,
                torch_dtype=torch.float32,
                local_files_only=local_files_only,
                safety_checker=None,
                requires_safety_checker=False,
            )

    pipe = pipe.to(device)
    if hasattr(pipe, "enable_attention_slicing"):
        pipe.enable_attention_slicing()
    if os.environ.get("CACSMS_LOCAL_IMAGE_USE_DPM_SOLVER", "1") == "1":
        try:
            pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
        except Exception:
            pass

    _pipeline = pipe
    return _pipeline


def enhance_face_regions(image: Image.Image) -> Image.Image:
    if os.environ.get("CACSMS_LOCAL_IMAGE_FACE_ENHANCE", "1") != "1":
        return image
    try:
        import cv2
        import numpy as np
    except ImportError:
        return image

    rgb = np.array(image.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(str(cascade_path))
    faces = cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(48, 48))
    if len(faces) == 0:
        return image

    for x, y, w, h in faces[:3]:
        pad_x = int(w * 0.14)
        pad_y = int(h * 0.16)
        x0 = max(0, x - pad_x)
        y0 = max(0, y - pad_y)
        x1 = min(bgr.shape[1], x + w + pad_x)
        y1 = min(bgr.shape[0], y + h + pad_y)
        roi = bgr[y0:y1, x0:x1]
        if roi.size == 0:
            continue
        lab = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8))
        l_channel = clahe.apply(l_channel)
        roi = cv2.cvtColor(cv2.merge([l_channel, a_channel, b_channel]), cv2.COLOR_LAB2BGR)
        blurred = cv2.GaussianBlur(roi, (0, 0), 1.0)
        roi = cv2.addWeighted(roi, 1.16, blurred, -0.16, 0)
        bgr[y0:y1, x0:x1] = roi

    return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))


def run_diffusion_inference(pipe, prompt: str, output: Path, width: int, height: int, seed: str) -> None:
    import torch

    device = os.environ.get("CACSMS_LOCAL_IMAGE_DEVICE", "cpu")
    family = resolve_model_family(os.environ.get("CACSMS_LOCAL_IMAGE_MODEL_ID", ""))
    default_steps = "22" if family == "sdxl" else "24" if device == "cpu" else "32"
    default_guidance = "6.0" if family == "sdxl" else "7.0"
    steps = int(os.environ.get("CACSMS_LOCAL_IMAGE_STEPS", default_steps))
    guidance = float(os.environ.get("CACSMS_LOCAL_IMAGE_GUIDANCE", default_guidance))
    render_width, render_height = diffusion_dimensions(width, height)
    enhanced, negative = build_diffusion_prompts(prompt)
    generator = torch.Generator(device=device).manual_seed(seed_to_int(seed))
    result = pipe(
        prompt=enhanced,
        negative_prompt=negative,
        width=render_width,
        height=render_height,
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
    )
    image = result.images[0]
    if image.size != (width, height):
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    image = enhance_face_regions(image)
    image = ImageEnhance.Sharpness(image).enhance(float(os.environ.get("CACSMS_LOCAL_IMAGE_SHARPNESS", "1.22")))
    image = ImageEnhance.Contrast(image).enhance(float(os.environ.get("CACSMS_LOCAL_IMAGE_CONTRAST", "1.04")))
    image = image.filter(
        ImageFilter.UnsharpMask(
            radius=float(os.environ.get("CACSMS_LOCAL_IMAGE_UNSHARP_RADIUS", "1.1")),
            percent=int(os.environ.get("CACSMS_LOCAL_IMAGE_UNSHARP_PERCENT", "135")),
            threshold=int(os.environ.get("CACSMS_LOCAL_IMAGE_UNSHARP_THRESHOLD", "2")),
        )
    )
    image.save(output)


def render_diffusion(prompt: str, output: Path, width: int, height: int, seed: str) -> None:
    pipe = load_diffusion_pipeline()
    run_diffusion_inference(pipe, prompt, output, width, height, seed)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt-file", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("--seed", required=True)
    args = parser.parse_args()

    prompt = read_prompt(Path(args.prompt_file))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    try:
        render_diffusion(prompt, output, args.width, args.height, args.seed)
    except Exception as exc:
        disable_fallback = os.environ.get("CACSMS_LOCAL_IMAGE_DISABLE_SCRIPT_FALLBACK") == "1"
        if disable_fallback or os.environ.get("CACSMS_LOCAL_IMAGE_MODEL_ID", "").strip():
            raise RuntimeError(f"Local diffusion render failed and script fallback is disabled: {exc}") from exc
        print(f"local neural renderer unavailable, using script fallback: {exc}", file=sys.stderr)
        fallback_image(prompt, output, args.width, args.height, args.seed)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
