#!/usr/bin/env python3
"""Resize raw App Store screenshots to iOS and Android required sizes."""

import os
from PIL import Image

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(PROJECT_DIR, "store", "screenshots", "raw")
IOS_DIR = os.path.join(PROJECT_DIR, "store", "screenshots", "ios")
ANDROID_DIR = os.path.join(PROJECT_DIR, "store", "screenshots", "android")
BG_COLOR = (11, 15, 25)  # #0B0F19

IOS_SIZES = {
    "iPhone-6-7": (1290, 2796),
    "iPhone-6-5": (1284, 2778),
    "iPhone-5-5": (1242, 2208),
}

ANDROID_SIZE = (1080, 1920)


def resize_image(src_path, dest_path, target_w, target_h):
    """Resize image to cover target dimensions, center-crop, and save."""
    img = Image.open(src_path).convert("RGB")
    # Create a canvas with background color
    canvas = Image.new("RGB", (target_w, target_h), BG_COLOR)
    
    # Resize image to cover the target area
    img_ratio = img.width / img.height
    target_ratio = target_w / target_h
    
    if img_ratio > target_ratio:
        # Image is wider - match height
        new_h = target_h
        new_w = int(target_h * img_ratio)
    else:
        # Image is taller - match width
        new_w = target_w
        new_h = int(target_w / img_ratio)
    
    img = img.resize((new_w, new_h), Image.LANCZOS)
    
    # Center the image on the canvas
    x = (target_w - new_w) // 2
    y = (target_h - new_h) // 2
    canvas.paste(img, (x, y))
    
    canvas.save(dest_path, "PNG", optimize=True)


def main():
    # Check raw directory exists
    if not os.path.isdir(RAW_DIR):
        print(f"Error: Raw screenshots directory not found: {RAW_DIR}")
        print("Run the Maestro capture flow first or check the path.")
        print("  maestro test .maestro/flows/screenshots/capture.yaml")
        return
    
    # Ensure output directories exist
    for size_name in IOS_SIZES:
        os.makedirs(os.path.join(IOS_DIR, size_name), exist_ok=True)
    os.makedirs(ANDROID_DIR, exist_ok=True)
    
    # Get all PNG files from raw directory
    raw_files = sorted([
        f for f in os.listdir(RAW_DIR)
        if f.lower().endswith(".png")
    ])
    
    if not raw_files:
        print("No PNG files found in", RAW_DIR)
        return
    
    print(f"Found {len(raw_files)} raw screenshots")
    print()
    
    for filename in raw_files:
        src_path = os.path.join(RAW_DIR, filename)
        name = os.path.splitext(filename)[0]
        print(f"  Processing: {filename}")
        
        # iOS sizes
        for size_name, (w, h) in IOS_SIZES.items():
            dest_dir = os.path.join(IOS_DIR, size_name)
            dest_path = os.path.join(dest_dir, f"{name}.png")
            resize_image(src_path, dest_path, w, h)
        
        # Android size
        dest_path = os.path.join(ANDROID_DIR, filename)
        resize_image(src_path, dest_path, ANDROID_SIZE[0], ANDROID_SIZE[1])
        
        print(f"    [OK] iOS (3 sizes) + Android")
    
    # Summary
    print()
    print("=" * 50)
    print("RESIZE COMPLETE [OK]")
    print("=" * 50)
    for size_name in IOS_SIZES:
        count = len(os.listdir(os.path.join(IOS_DIR, size_name)))
        print(f"  iOS {size_name}: {count} screenshots")
    android_count = len([f for f in os.listdir(ANDROID_DIR) if f.endswith(".png")])
    print(f"  Android:     {android_count} screenshots")
    print()


if __name__ == "__main__":
    main()
