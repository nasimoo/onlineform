#!/usr/bin/env python3
"""
Step-by-Step Form Automation
Takes a screenshot after each action for verification
"""

import os
import sys
import time
import json
import base64
import requests
import pandas as pd
import pyautogui
from datetime import datetime
import argparse

# Configuration
OMNIPARSER_URL = "http://localhost:8080/process_screenshot"
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.5

def take_screenshot(output_dir: str, step: int, description: str = "") -> str:
    """Take and save a screenshot"""
    screenshot_path = os.path.join(output_dir, f"step_{step:02d}_{description}.png")
    screenshot = pyautogui.screenshot()
    screenshot.save(screenshot_path)
    print(f"  📸 Screenshot: step_{step:02d}_{description}.png")
    return screenshot_path

def process_with_omniparser(image_path: str) -> pd.DataFrame:
    """Process image with OmniParser"""
    with open(image_path, 'rb') as f:
        image_bytes = f.read()

    encoded = base64.b64encode(image_bytes).decode('utf-8')
    payload = {
        "image_base64": encoded,
        "target_s3_prefix": "step_process"
    }

    try:
        response = requests.post(
            OMNIPARSER_URL,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        response.raise_for_status()
        result = response.json()

        if result.get('parsed_elements'):
            df = pd.DataFrame(result['parsed_elements'])
            return df
    except:
        pass

    return pd.DataFrame()

def find_element(df: pd.DataFrame, text: str):
    """Find element by text content"""
    for _, row in df.iterrows():
        if text.lower() in str(row['content']).lower():
            return row.to_dict()
    return None

def click_at_bbox(bbox, screen_width: int, screen_height: int):
    """Click at the center of a bounding box"""
    if isinstance(bbox, str):
        # Parse string bbox
        bbox = eval(bbox) if bbox.startswith('[') else bbox

    if isinstance(bbox, list):
        x1, y1, x2, y2 = bbox
        center_x = int((x1 + x2) / 2 * screen_width)
        center_y = int((y1 + y2) / 2 * screen_height)
        pyautogui.click(center_x, center_y)
        return center_x, center_y

    return None

def main():
    parser = argparse.ArgumentParser(description='Step-by-step form automation')
    parser.add_argument('--delay', type=int, default=3, help='Initial delay')
    args = parser.parse_args()

    # Setup
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = f"step_output_{timestamp}"
    os.makedirs(output_dir, exist_ok=True)

    screen_width, screen_height = pyautogui.size()

    # Load schema
    with open('schema.json', 'r') as f:
        schema = json.load(f)
    form_data = schema['form_data']

    print("\n" + "="*60)
    print("📋 STEP-BY-STEP FORM AUTOMATION")
    print("="*60)
    print(f"Screen: {screen_width}x{screen_height}")
    print(f"Output: {output_dir}")

    if args.delay > 0:
        print(f"\n⏱  Starting in {args.delay} seconds...")
        for i in range(args.delay, 0, -1):
            print(f"  {i}...", end='', flush=True)
            time.sleep(1)
        print()

    step = 0

    # Initial screenshot
    print(f"\n{'='*50}")
    print(f"Step {step}: Initial state")
    print('='*50)
    screenshot = take_screenshot(output_dir, step, "initial")
    df = process_with_omniparser(screenshot)
    print(f"  Found {len(df)} elements")
    time.sleep(1)

    # Check for popup and dismiss
    step += 1
    print(f"\n{'='*50}")
    print(f"Step {step}: Check for popup")
    print('='*50)

    for dismiss_text in ['dismiss', 'close', '×']:
        element = find_element(df, dismiss_text)
        if element and element.get('interactivity'):
            print(f"  Found popup: {element['content']}")
            coords = click_at_bbox(element['bbox'], screen_width, screen_height)
            if coords:
                print(f"  ✓ Clicked at {coords}")
                time.sleep(1)
                screenshot = take_screenshot(output_dir, step, "popup_dismissed")
                df = process_with_omniparser(screenshot)
            break

    # Process each field
    completed = []

    for field_name, value in form_data.items():
        step += 1
        print(f"\n{'='*50}")
        print(f"Step {step}: {field_name}")
        print('='*50)

        # Find field
        element = find_element(df, field_name)

        if not element:
            print(f"  ⊘ Field not visible, skipping")
            continue

        print(f"  ✓ Found: {element['content']}")

        # If it's a label, find the input field
        if not element.get('interactivity'):
            print(f"  📍 This is a label, looking for input...")

            # Find closest interactive element
            label_bbox = element['bbox']
            if isinstance(label_bbox, str):
                label_bbox = eval(label_bbox)

            label_y = label_bbox[1] if isinstance(label_bbox, list) else 0

            # Find interactive elements below this label
            best_input = None
            min_distance = float('inf')

            for _, row in df[df['interactivity'] == True].iterrows():
                elem_bbox = row['bbox']
                if isinstance(elem_bbox, str):
                    elem_bbox = eval(elem_bbox)

                if isinstance(elem_bbox, list):
                    elem_y = elem_bbox[1]
                    if elem_y > label_y:  # Element is below label
                        distance = elem_y - label_y
                        if distance < min_distance:
                            min_distance = distance
                            best_input = row.to_dict()

            if best_input:
                element = best_input
                print(f"  ✓ Found input field")

        # Click on the field
        coords = click_at_bbox(element['bbox'], screen_width, screen_height)
        if coords:
            print(f"  → Clicked at {coords}")
            time.sleep(0.5)

            # Handle different field types
            field_type = schema['field_types'].get(field_name, 'text')

            if field_type in ['text', 'email', 'tel', 'textarea']:
                # Clear field (triple-click to select all)
                pyautogui.click(coords[0], coords[1], clicks=3, interval=0.1)
                time.sleep(0.2)

                # Type the value
                print(f"  ⌨  Typing: {value}")
                pyautogui.write(str(value), interval=0.03)
                time.sleep(0.5)

                completed.append(field_name)
                print(f"  ✅ Completed: {field_name}")

            elif field_type == 'checkbox':
                # Just click for checkbox
                completed.append(field_name)
                print(f"  ✅ Checked: {field_name}")

            elif field_type == 'radio':
                # For radio, need to find the specific option
                options = schema['options'].get(field_name, {})
                option_label = options.get(value, value)
                print(f"  🔘 Looking for option: {option_label}")

                # Take new screenshot to find options
                time.sleep(0.5)
                temp_shot = take_screenshot(output_dir, step, f"{field_name}_options")
                df_options = process_with_omniparser(temp_shot)

                option_element = find_element(df_options, option_label)
                if option_element:
                    coords = click_at_bbox(option_element['bbox'], screen_width, screen_height)
                    if coords:
                        print(f"  ✓ Selected: {option_label}")
                        completed.append(field_name)

            # Take screenshot after action
            time.sleep(0.5)
            screenshot = take_screenshot(output_dir, step, f"{field_name}_done")
            df = process_with_omniparser(screenshot)  # Update elements

    # Submit form
    step += 1
    print(f"\n{'='*50}")
    print(f"Step {step}: Submit form")
    print('='*50)

    submit = find_element(df, 'submit')
    if submit and submit.get('interactivity'):
        coords = click_at_bbox(submit['bbox'], screen_width, screen_height)
        if coords:
            print(f"  ✓ Clicked Submit at {coords}")
            time.sleep(1)
            take_screenshot(output_dir, step, "submitted")
    else:
        print(f"  ⚠ Submit button not found")

    # Summary
    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)
    print(f"  Steps taken: {step}")
    print(f"  Fields completed: {len(completed)}/{len(form_data)}")
    print(f"  Screenshots saved: {step + 1}")

    if completed:
        print("\n  ✅ Completed fields:")
        for field in completed:
            print(f"    • {field}")

    print(f"\n📁 All screenshots saved to: {output_dir}")

if __name__ == "__main__":
    main()