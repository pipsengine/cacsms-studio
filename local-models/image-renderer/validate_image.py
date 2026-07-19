from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from transformers import CLIPModel, CLIPProcessor


LABELS = {
    "photoreal_humans": "a photorealistic documentary photograph with visible adult people, realistic faces and visible hands",
    "empty_environment": "an empty industrial factory or operations control room with no people visible",
    "cartoon_illustration": "a cartoon vector illustration or flat graphic with simplified people",
    "three_d_avatar": "a 3d rendered avatar scene with plastic artificial people",
    "low_quality_humans": "a blurry low quality image of people with distorted faces, bad hands, or malformed anatomy",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--prompt", default="")
    parser.add_argument("--model-id", default=os.environ.get("CACSMS_LOCAL_IMAGE_VALIDATOR_MODEL_ID", ""))
    args = parser.parse_args()

    image_path = Path(args.image)
    image = Image.open(image_path).convert("RGB")
    rgb = np.array(image)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    max_width = 960
    if gray.shape[1] > max_width:
        scale = max_width / gray.shape[1]
        gray = cv2.resize(gray, (max_width, int(gray.shape[0] * scale)), interpolation=cv2.INTER_AREA)
        bgr = cv2.resize(bgr, (max_width, int(bgr.shape[0] * scale)), interpolation=cv2.INTER_AREA)

    cascade_dir = Path(cv2.data.haarcascades)
    cascades = {
        "face": cv2.CascadeClassifier(str(cascade_dir / "haarcascade_frontalface_default.xml")),
        "profile": cv2.CascadeClassifier(str(cascade_dir / "haarcascade_profileface.xml")),
        "upper_body": cv2.CascadeClassifier(str(cascade_dir / "haarcascade_upperbody.xml")),
        "full_body": cv2.CascadeClassifier(str(cascade_dir / "haarcascade_fullbody.xml")),
    }
    raw_faces = list(cascades["face"].detectMultiScale(gray, scaleFactor=1.08, minNeighbors=3, minSize=(28, 28)))
    raw_profiles = list(cascades["profile"].detectMultiScale(gray, scaleFactor=1.08, minNeighbors=3, minSize=(28, 28)))
    upper = list(cascades["upper_body"].detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(48, 64)))
    full = list(cascades["full_body"].detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(48, 96)))

    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    skin_mask = cv2.inRange(ycrcb, np.array((35, 135, 70), dtype=np.uint8), np.array((235, 185, 135), dtype=np.uint8))
    kernel = np.ones((5, 5), np.uint8)
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel)
    skin_components, labels, stats, _ = cv2.connectedComponentsWithStats(skin_mask, 8)
    min_area = max(80, int(gray.shape[0] * gray.shape[1] * 0.00035))
    skin_regions = [
        int(stats[index, cv2.CC_STAT_AREA])
        for index in range(1, skin_components)
        if int(stats[index, cv2.CC_STAT_AREA]) >= min_area
    ]
    skin_boxes = [
        (
            int(stats[index, cv2.CC_STAT_LEFT]),
            int(stats[index, cv2.CC_STAT_TOP]),
            int(stats[index, cv2.CC_STAT_WIDTH]),
            int(stats[index, cv2.CC_STAT_HEIGHT]),
            int(stats[index, cv2.CC_STAT_AREA]),
        )
        for index in range(1, skin_components)
        if int(stats[index, cv2.CC_STAT_AREA]) >= min_area
    ]
    skin_ratio = float(cv2.countNonZero(skin_mask)) / float(gray.shape[0] * gray.shape[1])
    def skin_fraction(rect) -> float:
        x, y, w, h = [int(value) for value in rect]
        roi = skin_mask[max(0, y): min(skin_mask.shape[0], y + h), max(0, x): min(skin_mask.shape[1], x + w)]
        return float(cv2.countNonZero(roi)) / float(max(1, w * h))

    faces = [rect for rect in raw_faces if skin_fraction(rect) >= 0.16]
    profiles = [rect for rect in raw_profiles if skin_fraction(rect) >= 0.16]
    face_count = len(faces) + len(profiles)
    body_count = len(upper) + len(full)
    strong_skin_human_signal = skin_ratio >= 0.025 and skin_ratio <= 0.22 and len(skin_regions) >= 6
    h, w = gray.shape[:2]
    subject_box = None
    if skin_boxes:
        primary_boxes = sorted(skin_boxes, key=lambda item: item[4], reverse=True)[:4]
        left = min(item[0] for item in primary_boxes)
        top = min(item[1] for item in primary_boxes)
        right = max(item[0] + item[2] for item in primary_boxes)
        bottom = max(item[1] + item[3] for item in primary_boxes)
        subject_box = (left, top, right - left, bottom - top)
    elif upper or full:
        body_boxes = list(upper) + list(full)
        left = min(int(item[0]) for item in body_boxes)
        top = min(int(item[1]) for item in body_boxes)
        right = max(int(item[0] + item[2]) for item in body_boxes)
        bottom = max(int(item[1] + item[3]) for item in body_boxes)
        subject_box = (left, top, right - left, bottom - top)

    if subject_box:
        sx, sy, sw, sh = subject_box
        coverage = float(sw * sh) / float(max(1, w * h))
        cx = (sx + sw / 2) / max(1, w)
        cy = (sy + sh / 2) / max(1, h)
        center_offset = abs(cx - 0.5) + abs(cy - 0.48)
        margin = 0.08
        safe_area_pass = sx > w * margin and sy > h * margin and (sx + sw) < w * (1 - margin) and (sy + sh) < h * (1 - margin)
        cropped_risk = sx <= w * 0.025 or sy <= h * 0.025 or (sx + sw) >= w * 0.975 or (sy + sh) >= h * 0.975
    else:
        coverage = 0.0
        center_offset = 1.0
        safe_area_pass = False
        cropped_risk = True
    laplacian_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    blur_score = min(1.0, laplacian_variance / 95.0)
    subject_coverage_pass = 0.08 <= coverage <= 0.58
    focal_subject_pass = center_offset <= 0.58 and coverage >= 0.08
    blur_pass = blur_score >= 0.34
    composition_pass = subject_coverage_pass and focal_subject_pass and safe_area_pass and not cropped_risk and blur_pass

    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    metal_blue = cv2.inRange(hsv, np.array((85, 45, 45), dtype=np.uint8), np.array((135, 255, 255), dtype=np.uint8))
    metal_blue_ratio = float(cv2.countNonZero(metal_blue)) / float(max(1, w * h))
    robotic_feature_risk = metal_blue_ratio > 0.18 and skin_ratio < 0.075
    human_signal = min(1.0, face_count * 0.52 + body_count * 0.34 + min(len(skin_regions), 4) * 0.08 + min(skin_ratio, 0.05) * 2.0)
    empty_signal = max(0.0, 1.0 - human_signal)
    scores = {
        "photoreal_humans": human_signal,
        "empty_environment": empty_signal,
        "cartoon_illustration": 0.04,
        "three_d_avatar": 0.04,
        "low_quality_humans": 0.55 if face_count == 0 else 0.18,
    }

    model_id = "opencv-haar-human-evidence"
    clip_model_id = args.model_id or os.environ.get("CACSMS_LOCAL_IMAGE_MODEL_VALIDATOR") or ""
    if clip_model_id and Path(clip_model_id).exists() and (Path(clip_model_id) / "pytorch_model.bin").exists():
        import torch

        local_only = os.environ.get("CACSMS_LOCAL_IMAGE_OFFLINE", "1") == "1"
        device = os.environ.get("CACSMS_LOCAL_IMAGE_VALIDATOR_DEVICE", os.environ.get("CACSMS_LOCAL_IMAGE_DEVICE", "cpu"))
        texts = list(LABELS.values())
        processor = CLIPProcessor.from_pretrained(clip_model_id, local_files_only=local_only)
        model = CLIPModel.from_pretrained(clip_model_id, local_files_only=local_only)
        model = model.to(device)
        inputs = processor(text=texts, images=image, return_tensors="pt", padding=True)
        inputs = {key: value.to(device) for key, value in inputs.items()}
        with torch.no_grad():
            outputs = model(**inputs)
            probs = outputs.logits_per_image.softmax(dim=1)[0].detach().cpu().tolist()
        clip_scores = {key: float(probs[index]) for index, key in enumerate(LABELS.keys())}
        scores = {key: max(scores.get(key, 0.0), clip_scores.get(key, 0.0)) for key in LABELS.keys()}
        model_id = str(clip_model_id)

    result = {
        "model": str(model_id),
        "detectors": {
            "faces": face_count,
            "rawFaces": len(raw_faces) + len(raw_profiles),
            "bodies": body_count,
            "skinRegions": len(skin_regions),
            "skinRatio": skin_ratio,
            "strongSkinHumanSignal": strong_skin_human_signal,
        },
        "composition": {
            "subjectBox": list(subject_box) if subject_box else None,
            "subjectCoverage": coverage,
            "centerOffset": center_offset,
            "safeAreaPass": safe_area_pass,
            "croppedRisk": cropped_risk,
            "laplacianVariance": laplacian_variance,
            "blurScore": blur_score,
            "subjectCoveragePass": subject_coverage_pass,
            "focalSubjectPass": focal_subject_pass,
            "blurPass": blur_pass,
            "compositionPass": composition_pass,
            "roboticFeatureRisk": robotic_feature_risk,
        },
        "scores": scores,
        "passedHumanPresence": face_count >= 1 or (strong_skin_human_signal and scores["photoreal_humans"] >= 0.4),
        "passedPhotographicStyle": scores["cartoon_illustration"] < 0.28 and scores["three_d_avatar"] < 0.28,
        "passedAnatomyRisk": (face_count >= 1 and scores["low_quality_humans"] < 0.34) or strong_skin_human_signal,
        "passedComposition": composition_pass,
        "passedNaturalHuman": not robotic_feature_risk,
    }
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
