"""
Palm image preprocessing utilities using OpenCV.
Handles ROI extraction, enhancement, and line detection.
"""

import cv2
import numpy as np
from loguru import logger
from pathlib import Path


def preprocess_palm_image(image_path: str, output_dir: str) -> dict:
    """
    Preprocess a palm image for feature extraction.

    Pipeline:
      1. Load and resize
      2. Convert to grayscale
      3. CLAHE contrast enhancement
      4. Gaussian blur for noise reduction
      5. Adaptive threshold for binarization
      6. Morphological operations to clean up
      7. Save preprocessed image

    Returns a dict with preprocessed image path and intermediate results.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    # 调整到统一尺寸，保持宽高比
    h, w = img.shape[:2]
    target_size = 800
    scale = target_size / max(h, w)
    new_w, new_h = int(w * scale), int(h * scale)
    img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # 转灰度
    gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)

    # CLAHE 自适应直方图均衡化 - 增强掌纹对比度
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # 高斯模糊降噪
    blurred = cv2.GaussianBlur(enhanced, (5, 5), 0)

    # 自适应阈值二值化 - 突出掌纹线条
    binary = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 5
    )

    # 形态学操作 - 闭运算连接断裂线条
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)

    # 保存预处理结果
    stem = Path(image_path).stem
    preprocessed_path = str(Path(output_dir) / f"{stem}_preprocessed.jpg")
    enhanced_path = str(Path(output_dir) / f"{stem}_enhanced.jpg")

    cv2.imwrite(preprocessed_path, cleaned)
    cv2.imwrite(enhanced_path, enhanced)

    return {
        "preprocessed_path": preprocessed_path,
        "enhanced_path": enhanced_path,
        "image_size": (new_w, new_h),
        "original_size": (w, h),
    }


def extract_palm_features(preprocessed_path: str) -> dict:
    """
    Extract palm line features from preprocessed binary image.

    Uses Hough Line Transform and contour analysis to detect
    major palm lines and compute structural features.

    Returns a dict of extracted features.
    """
    binary = cv2.imread(preprocessed_path, cv2.IMREAD_GRAYSCALE)
    if binary is None:
        raise ValueError(f"Cannot read preprocessed image: {preprocessed_path}")

    h, w = binary.shape

    # --- Hough 直线检测 ---
    lines = cv2.HoughLinesP(
        binary,
        rho=1,
        theta=np.pi / 180,
        threshold=50,
        minLineLength=w * 0.15,
        maxLineGap=20,
    )

    line_features = _classify_lines(lines, w, h) if lines is not None else {}

    # --- 轮廓分析 ---
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # 按面积排序，取主要轮廓
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    major_contours = [c for c in contours[:20] if cv2.contourArea(c) > (w * h * 0.001)]

    contour_features = {
        "total_contours": len(contours),
        "major_contours": len(major_contours),
        "palm_coverage_ratio": round(
            sum(cv2.contourArea(c) for c in major_contours) / (w * h), 4
        ),
    }

    # --- 纹路密度分析 ---
    # 将图像分为上中下三个区域，分析纹路密度
    region_h = h // 3
    density_features = {}
    for i, region_name in enumerate(["upper", "middle", "lower"]):
        region = binary[i * region_h : (i + 1) * region_h, :]
        pixel_ratio = np.count_nonzero(region) / region.size
        density_features[f"{region_name}_density"] = round(pixel_ratio, 4)

    features = {
        **line_features,
        **contour_features,
        **density_features,
        "image_width": w,
        "image_height": h,
    }

    return features


def _classify_lines(lines, img_w: int, img_h: int) -> dict:
    """
    Classify detected lines into palm line categories based on
    position and angle heuristics.

    Heuristic rules (approximate):
      - Heart line: upper 1/3, roughly horizontal
      - Head line: middle 1/3, roughly horizontal
      - Life line: curved, spans from upper-left to lower region
      - Fate line: roughly vertical, center area
    """
    horizontal_lines = []
    vertical_lines = []
    diagonal_lines = []

    for line in lines:
        x1, y1, x2, y2 = line[0]
        length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        angle = np.degrees(np.arctan2(abs(y2 - y1), abs(x2 - x1)))

        line_info = {
            "x1": int(x1), "y1": int(y1),
            "x2": int(x2), "y2": int(y2),
            "length": round(float(length), 2),
            "angle": round(float(angle), 2),
            "center_y": (y1 + y2) / 2,
            "center_x": (x1 + x2) / 2,
        }

        if angle < 30:
            horizontal_lines.append(line_info)
        elif angle > 60:
            vertical_lines.append(line_info)
        else:
            diagonal_lines.append(line_info)

    # 按长度排序
    horizontal_lines.sort(key=lambda l: l["length"], reverse=True)
    vertical_lines.sort(key=lambda l: l["length"], reverse=True)
    diagonal_lines.sort(key=lambda l: l["length"], reverse=True)

    features = {
        "total_lines_detected": len(lines),
        "horizontal_lines": len(horizontal_lines),
        "vertical_lines": len(vertical_lines),
        "diagonal_lines": len(diagonal_lines),
    }

    # 尝试识别主要掌纹线
    # 感情线 (Heart Line) - 上部水平线中最长的
    upper_horizontals = [l for l in horizontal_lines if l["center_y"] < img_h * 0.35]
    if upper_horizontals:
        heart = upper_horizontals[0]
        features["heart_line_length"] = heart["length"]
        features["heart_line_ratio"] = round(heart["length"] / img_w, 4)

    # 智慧线 (Head Line) - 中部水平线中最长的
    mid_horizontals = [
        l for l in horizontal_lines if img_h * 0.3 < l["center_y"] < img_h * 0.6
    ]
    if mid_horizontals:
        head = mid_horizontals[0]
        features["head_line_length"] = head["length"]
        features["head_line_ratio"] = round(head["length"] / img_w, 4)

    # 生命线 (Life Line) - 对角线中最长的
    if diagonal_lines:
        life = diagonal_lines[0]
        features["life_line_length"] = life["length"]
        features["life_line_ratio"] = round(life["length"] / max(img_w, img_h), 4)

    # 命运线 (Fate Line) - 中部垂直线
    center_verticals = [
        l for l in vertical_lines
        if img_w * 0.3 < l["center_x"] < img_w * 0.7
    ]
    if center_verticals:
        fate = center_verticals[0]
        features["fate_line_length"] = fate["length"]
        features["fate_line_detected"] = "yes"
    else:
        features["fate_line_detected"] = "no"

    return features