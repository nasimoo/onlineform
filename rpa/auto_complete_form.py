#!/usr/bin/env python3
"""
Comprehensive Form Automation Script
1. Takes a screenshot of the current screen
2. Processes it with OmniParser to detect UI elements
3. Automatically fills the form based on schema.json
"""

import os
import sys
import time
import json
import base64
import requests
import tempfile
import subprocess
from datetime import datetime
import pandas as pd
import pyautogui
from PIL import Image
import argparse
from typing import Tuple, List, Dict, Any, Union

# Import functions from form_automation
from form_automation import (
    load_schema,
    get_screen_size,
    convert_bbox_to_screen,
    parse_bbox_string,
    load_elements,
    find_element_by_content,
    find_input_field_near_label,
    click_element,
    type_text,
    handle_checkbox_group,
    handle_radio_group,
    handle_select_dropdown,
    handle_checkbox,
    dismiss_popup,
    detect_visible_fields
)

# Configuration
OMNIPARSER_URL = "http://localhost:8080/process_screenshot"
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.3


def take_screenshot() -> str:
    """Take a screenshot and save it temporarily"""
    print("📸 Taking screenshot...")

    # Create temp directory if it doesn't exist
    temp_dir = tempfile.gettempdir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_path = os.path.join(temp_dir, f"form_screenshot_{timestamp}.png")

    # Take screenshot using pyautogui
    screenshot = pyautogui.screenshot()
    screenshot.save(screenshot_path)

    print(f"  ✓ Screenshot saved: {screenshot_path}")
    return screenshot_path


def process_with_omniparser(screenshot_path: str, output_dir: str) -> Dict[str, Any]:
    """Process screenshot with OmniParser API"""
    print("\n🔍 Processing with OmniParser...")

    # Read and encode image
    with open(screenshot_path, 'rb') as f:
        image_bytes = f.read()

    encoded = base64.b64encode(image_bytes).decode('utf-8')

    # Prepare request
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prefix = f"auto_{timestamp}"

    payload = {
        "image_base64": encoded,
        "target_s3_prefix": prefix
    }

    # Send request to OmniParser
    print("  → Sending to OmniParser API...")
    try:
        response = requests.post(
            OMNIPARSER_URL,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        response.raise_for_status()
        result = response.json()

        # Save results locally
        os.makedirs(output_dir, exist_ok=True)

        # Save response
        response_path = os.path.join(output_dir, 'response.json')
        with open(response_path, 'w') as f:
            json.dump(result, f, indent=2)

        # Save elements
        elements_path = os.path.join(output_dir, 'elements.json')
        with open(elements_path, 'w') as f:
            json.dump(result.get('parsed_elements', []), f, indent=2)

        # Create bbox.csv
        csv_path = os.path.join(output_dir, 'bbox.csv')
        if result.get('parsed_elements'):
            df = pd.DataFrame(result['parsed_elements'])
            if 'ID' not in df.columns:
                df['ID'] = range(len(df))
            df.to_csv(csv_path, index=False)
            print(f"  ✓ Detected {len(df)} UI elements")
        else:
            print("  ⚠ No elements detected")
            return None

        # Copy files from local_store if available
        if 'local_annotated_image_path' in result and result['local_annotated_image_path']:
            src = result['local_annotated_image_path']
            if os.path.exists(src):
                import shutil
                dst = os.path.join(output_dir, 'annotated.png')
                shutil.copy2(src, dst)
                print(f"  ✓ Saved annotated image")

        print(f"  ✓ Results saved to: {output_dir}")
        return result

    except requests.exceptions.RequestException as e:
        print(f"  ❌ Error calling OmniParser API: {e}")
        print("  Make sure OmniParser is running (app_local.py on port 8080)")
        return None
    except Exception as e:
        print(f"  ❌ Unexpected error: {e}")
        return None


def fill_form_automated(csv_path: str, schema_path: str = None):
    """
    Automate form filling using bbox data and schema
    (Modified version of fill_form with better integration)
    """
    # Load schema and elements
    schema = load_schema(schema_path)
    df = load_elements(csv_path)
    screen_width, screen_height = get_screen_size()

    form_data = schema.get('form_data', {})
    field_types = schema.get('field_types', {})
    options = schema.get('options', {})

    print(f"\n📊 Screen size: {screen_width}x{screen_height}")

    # Detect which fields are visible
    print("\n" + "="*50)
    print("🔎 Detecting visible form fields...")
    print("="*50)
    visible_field_names = detect_visible_fields(df, schema)
    print(f"\n📋 Detected {len(visible_field_names)} visible fields out of {len(form_data)} in schema:")
    for field in visible_field_names:
        print(f"  • {field}")

    if len(visible_field_names) == 0:
        print("\n⚠️  No form fields detected! Make sure:")
        print("  1. The form is visible on screen")
        print("  2. The browser is in focus")
        print("  3. The form page is loaded")
        return False

    print("\n" + "="*50)
    print("🤖 Starting form automation in 3 seconds...")
    print("   (Move mouse to upper-left corner to abort)")
    print("="*50 + "\n")
    time.sleep(3)

    # Check for and dismiss any popup first
    dismiss_popup(df, screen_width, screen_height)

    # Process each form field
    completed_fields = []
    skipped_fields = []
    failed_fields = []

    for field_name, value in form_data.items():
        print(f"\n📝 Processing: {field_name}")

        field_type = field_types.get(field_name, 'text')
        field_options = options.get(field_name, {})

        try:
            # Find the field element
            element = find_element_by_content(df, field_name)

            if not element:
                # Try with fuzzy matching
                element = find_element_by_content(df, field_name, fuzzy=True)

            if element:
                print(f"  ✓ Found: {element.get('content')}")

                # Handle based on field type
                if field_type in ['text', 'email', 'tel', 'textarea']:
                    # For text fields, find the input near the label
                    if not element.get('interactivity'):
                        input_element = find_input_field_near_label(df, element)
                        if input_element:
                            click_element(input_element, screen_width, screen_height)
                            type_text(str(value))
                            completed_fields.append(field_name)
                        else:
                            print(f"  ⚠ Could not find input field")
                            failed_fields.append(field_name)
                    else:
                        click_element(element, screen_width, screen_height)
                        type_text(str(value))
                        completed_fields.append(field_name)

                elif field_type == 'radio':
                    handle_radio_group(df, field_name, value, screen_width, screen_height, field_options)
                    completed_fields.append(field_name)

                elif field_type == 'checkbox-group':
                    handle_checkbox_group(df, field_name, value, screen_width, screen_height)
                    completed_fields.append(field_name)

                elif field_type == 'select':
                    input_element = find_input_field_near_label(df, element)
                    if input_element:
                        handle_select_dropdown(df, input_element, value, screen_width, screen_height, field_options)
                        completed_fields.append(field_name)

                elif field_type == 'checkbox':
                    if element.get('interactivity'):
                        handle_checkbox(element, value, screen_width, screen_height)
                    else:
                        checkbox_element = find_input_field_near_label(df, element)
                        if checkbox_element:
                            handle_checkbox(checkbox_element, value, screen_width, screen_height)
                    completed_fields.append(field_name)

            else:
                print(f"  ⊘ Not visible (skipping)")
                skipped_fields.append(field_name)

        except Exception as e:
            print(f"  ❌ Error: {e}")
            failed_fields.append(field_name)
            continue

    # Look for submit button
    print("\n" + "="*50)
    print("🎯 Looking for Submit button...")
    print("="*50)

    time.sleep(1)

    submit_found = False
    for submit_text in ['submit', 'Submit', 'SUBMIT', 'Send', 'send']:
        submit = find_element_by_content(df, submit_text, fuzzy=True)
        if submit and submit.get('interactivity'):
            print(f"  ✓ Found: {submit.get('content')}")
            click_element(submit, screen_width, screen_height)
            print("  ✅ Form submitted!")
            submit_found = True
            break

    if not submit_found:
        print("  ⚠ Could not find Submit button")

    # Print summary
    print("\n" + "="*50)
    print("📊 AUTOMATION SUMMARY")
    print("="*50)

    total_fields = len(form_data)
    visible = len(completed_fields) + len(failed_fields)

    print(f"\n📈 Results:")
    print(f"  • Total fields in schema: {total_fields}")
    print(f"  • Fields visible on form: {visible}")
    print(f"  • Successfully filled: {len(completed_fields)}")
    print(f"  • Skipped (not visible): {len(skipped_fields)}")
    print(f"  • Failed: {len(failed_fields)}")

    if visible > 0:
        success_rate = (len(completed_fields) / visible) * 100
        print(f"\n✨ Success Rate: {success_rate:.1f}%")

    if completed_fields:
        print(f"\n✅ Completed fields:")
        for field in completed_fields:
            print(f"  ✓ {field}")

    if failed_fields:
        print(f"\n❌ Failed fields:")
        for field in failed_fields:
            print(f"  ✗ {field}")

    return len(failed_fields) == 0


def main():
    parser = argparse.ArgumentParser(
        description='Complete form automation: Screenshot → OmniParser → Form Filling'
    )
    parser.add_argument('--schema', type=str, help='Path to schema.json file')
    parser.add_argument('--delay', type=int, default=3,
                       help='Delay in seconds before taking screenshot (default: 3)')
    parser.add_argument('--output-dir', type=str, help='Output directory for results')
    parser.add_argument('--screenshot', type=str, help='Use existing screenshot instead of taking new one')

    args = parser.parse_args()

    # Determine paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    schema_path = args.schema if args.schema else os.path.join(script_dir, 'schema.json')

    if not os.path.exists(schema_path):
        print(f"❌ Schema file not found: {schema_path}")
        sys.exit(1)

    # Create output directory
    if args.output_dir:
        output_dir = args.output_dir
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = os.path.join(script_dir, f"auto_output_{timestamp}")

    print("="*60)
    print("🚀 COMPREHENSIVE FORM AUTOMATION")
    print("="*60)
    print(f"📋 Schema: {schema_path}")
    print(f"📁 Output: {output_dir}")

    # Step 1: Screenshot
    if args.screenshot and os.path.exists(args.screenshot):
        print(f"\n📸 Using existing screenshot: {args.screenshot}")
        screenshot_path = args.screenshot
    else:
        if args.delay > 0:
            print(f"\n⏱️  Waiting {args.delay} seconds before screenshot...")
            print("   Switch to your browser with the form!")
            for i in range(args.delay, 0, -1):
                print(f"   {i}...", end='', flush=True)
                time.sleep(1)
            print()
        screenshot_path = take_screenshot()

    # Step 2: Process with OmniParser
    result = process_with_omniparser(screenshot_path, output_dir)

    if not result:
        print("\n❌ Failed to process screenshot with OmniParser")
        sys.exit(1)

    # Step 3: Fill the form
    csv_path = os.path.join(output_dir, 'bbox.csv')

    if not os.path.exists(csv_path):
        print("\n❌ No bbox.csv generated - cannot proceed with form filling")
        sys.exit(1)

    print("\n" + "="*60)
    print("📝 STARTING FORM FILLING")
    print("="*60)

    success = fill_form_automated(csv_path, schema_path)

    # Clean up temporary screenshot if we took one
    if not args.screenshot and os.path.exists(screenshot_path):
        try:
            os.remove(screenshot_path)
        except:
            pass

    print("\n" + "="*60)
    if success:
        print("✅ AUTOMATION COMPLETED SUCCESSFULLY!")
    else:
        print("⚠️  AUTOMATION COMPLETED WITH SOME ISSUES")
    print("="*60)
    print(f"\n📁 All results saved to: {output_dir}")

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())