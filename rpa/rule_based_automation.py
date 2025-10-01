#!/usr/bin/env python3
"""
Rule-Based Form Automation with OmniParser
- Uses OmniParser to detect UI elements
- Uses strict rules to match fields to elements
- Types values based on schema
- No AI decision making, only rule-based matching
"""

import os
import sys
import time
import json
import base64
import requests
import tempfile
import pandas as pd
import pyautogui
from datetime import datetime
from typing import Tuple, List, Dict, Any, Optional
import argparse

# Configuration
OMNIPARSER_URL = "http://localhost:8080/process_screenshot"
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.5

# Import functions from form_automation
from form_automation import (
    load_schema,
    get_screen_size,
    convert_bbox_to_screen,
    click_element,
    type_text,
    parse_bbox_string
)


class RuleBasedFormAutomation:
    def __init__(self, schema_path: str, output_dir: str):
        self.schema = load_schema(schema_path)
        self.output_dir = output_dir
        self.screen_width, self.screen_height = get_screen_size()
        self.action_count = 0
        self.completed_fields = []

        # Create output directory
        os.makedirs(self.output_dir, exist_ok=True)

        # Create subdirectories for screenshots
        self.screenshots_dir = os.path.join(self.output_dir, "screenshots")
        self.parsed_dir = os.path.join(self.output_dir, "parsed")
        os.makedirs(self.screenshots_dir, exist_ok=True)
        os.makedirs(self.parsed_dir, exist_ok=True)

    def take_screenshot(self, name: str = None) -> str:
        """Take a screenshot and save it"""
        if name is None:
            name = f"screenshot_{self.action_count:03d}"

        screenshot_path = os.path.join(self.screenshots_dir, f"{name}.png")
        screenshot = pyautogui.screenshot()
        screenshot.save(screenshot_path)

        print(f"  📸 Screenshot saved: {name}.png")
        return screenshot_path

    def process_with_omniparser(self, screenshot_path: str) -> Optional[pd.DataFrame]:
        """Process screenshot with OmniParser and return DataFrame of elements"""
        print("  🔍 Processing with OmniParser...")

        with open(screenshot_path, 'rb') as f:
            image_bytes = f.read()

        encoded = base64.b64encode(image_bytes).decode('utf-8')
        prefix = f"action_{self.action_count:03d}"

        payload = {
            "image_base64": encoded,
            "target_s3_prefix": prefix
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

            # Save parsed results
            parsed_path = os.path.join(self.parsed_dir, f"parsed_{self.action_count:03d}.json")
            with open(parsed_path, 'w') as f:
                json.dump(result, f, indent=2)

            # Create DataFrame from elements
            if result.get('parsed_elements'):
                df = pd.DataFrame(result['parsed_elements'])
                if 'bbox' in df.columns:
                    # Safely parse bbox, handling both string and list formats
                    def safe_parse_bbox(bbox):
                        try:
                            return parse_bbox_string(bbox)
                        except:
                            return bbox
                    df['bbox_parsed'] = df['bbox'].apply(safe_parse_bbox)

                # Save CSV
                csv_path = os.path.join(self.parsed_dir, f"elements_{self.action_count:03d}.csv")
                df.to_csv(csv_path, index=False)

                print(f"    ✓ Detected {len(df)} elements")
                return df

            return None

        except Exception as e:
            print(f"    ❌ Error: {e}")
            return None

    def check_for_popup(self, df: pd.DataFrame) -> Optional[Dict]:
        """Check for popups to dismiss"""
        dismiss_words = ['dismiss', 'close', '×', 'x', 'ok', 'got it', 'accept']

        for word in dismiss_words:
            for _, row in df.iterrows():
                content = row['content'].strip().lower()
                if word.lower() in content and row.get('interactivity'):
                    return row.to_dict()
        return None

    def find_field_element(self, df: pd.DataFrame, field_name: str) -> Optional[Dict]:
        """Find element for a field using strict rules"""

        # Clean field name for matching
        field_clean = field_name.lower().replace('_', ' ').replace('-', ' ')

        # Try exact match first
        for _, row in df.iterrows():
            content = row['content'].strip().lower()

            # Exact match with field name
            if field_clean in content or content in field_clean:
                if row.get('interactivity'):
                    # It's an input field
                    return row.to_dict()
                else:
                    # It's a label, find nearest input below
                    return self.find_input_near_label(df, row)

        # Try partial match (each word in field name)
        field_words = field_clean.split()
        for _, row in df.iterrows():
            content = row['content'].strip().lower()

            # Check if any field word matches
            if any(word in content for word in field_words if len(word) > 2):
                if row.get('interactivity'):
                    return row.to_dict()
                else:
                    return self.find_input_near_label(df, row)

        # Special cases for common field variations
        variations = {
            'full name': ['name', 'full', 'your name'],
            'phone number': ['phone', 'tel', 'mobile', 'cell'],
            'email': ['email', 'e-mail', 'mail'],
            'address': ['address', 'location', 'street'],
            'dob': ['birth', 'birthday', 'date of birth', 'dob'],
            'emergency': ['emergency', 'contact']
        }

        for key, variants in variations.items():
            if any(v in field_clean for v in variants):
                for variant in variants:
                    for _, row in df.iterrows():
                        content = row['content'].strip().lower()
                        if variant in content:
                            if row.get('interactivity'):
                                return row.to_dict()
                            else:
                                return self.find_input_near_label(df, row)

        return None

    def find_input_near_label(self, df: pd.DataFrame, label_row: pd.Series) -> Optional[Dict]:
        """Find the nearest input field to a label"""
        # Use bbox_parsed if available, otherwise parse bbox
        if 'bbox_parsed' in label_row and label_row['bbox_parsed'] is not None:
            label_bbox = label_row['bbox_parsed']
        else:
            label_bbox = parse_bbox_string(label_row['bbox'])
        label_y = label_bbox[1]
        label_x = label_bbox[0]

        # Get all interactive elements
        interactive_df = df[df['interactivity'] == True]

        if interactive_df.empty:
            return None

        # Find elements below or to the right of the label
        candidates = []
        for _, row in interactive_df.iterrows():
            # Use bbox_parsed if available
            if 'bbox_parsed' in row and row['bbox_parsed'] is not None:
                elem_bbox = row['bbox_parsed']
            else:
                elem_bbox = parse_bbox_string(row['bbox'])
            elem_y = elem_bbox[1]
            elem_x = elem_bbox[0]

            # Element is below the label (within reasonable distance)
            if elem_y > label_y and elem_y < label_y + 0.1:
                candidates.append((row, elem_y - label_y))
            # Element is to the right of the label (same line)
            elif abs(elem_y - label_y) < 0.01 and elem_x > label_x:
                candidates.append((row, elem_x - label_x))

        if candidates:
            # Return the closest candidate
            candidates.sort(key=lambda x: x[1])
            return candidates[0][0].to_dict()

        # If no good candidate, return the first interactive element after the label
        below_elements = interactive_df[interactive_df['bbox'].apply(
            lambda x: parse_bbox_string(x)[1] > label_y
        )]

        if not below_elements.empty:
            return below_elements.iloc[0].to_dict()

        return None

    def find_submit_button(self, df: pd.DataFrame) -> Optional[Dict]:
        """Find submit button"""
        submit_words = ['submit', 'send', 'save', 'continue', 'next', 'finish']

        for word in submit_words:
            for _, row in df.iterrows():
                content = row['content'].strip().lower()
                if word in content and row.get('interactivity'):
                    return row.to_dict()
        return None

    def execute_field_action(self, element: Dict, field_name: str, value: Any) -> bool:
        """Execute action to fill a field"""

        print(f"\n  📝 Filling field: {field_name}")
        print(f"    Target element: {element['content']}")
        print(f"    Value to enter: {value}")

        # Click on the field
        click_element(element, self.screen_width, self.screen_height)
        time.sleep(0.5)  # Wait for field to focus

        # Type the value
        if value:
            value_str = str(value)
            print(f"    ⌨️  Typing: '{value_str}'")

            # Use type_text which handles clearing
            type_text(value_str, clear_first=True)

            print(f"    ✓ Typed successfully")
            time.sleep(0.3)  # Wait for typing to complete

            # Mark as completed
            if field_name not in self.completed_fields:
                self.completed_fields.append(field_name)

            return True

        return False

    def run(self):
        """Main automation loop"""
        print("\n" + "="*60)
        print("🤖 RULE-BASED FORM AUTOMATION")
        print("="*60)

        # Get form data from schema
        form_data = self.schema.get('form_data', {})
        field_types = self.schema.get('field_types', {})

        # Get list of fields to fill
        fields_to_fill = list(form_data.keys())

        print(f"\n📋 Total fields to fill: {len(fields_to_fill)}")
        for field in fields_to_fill:
            print(f"    • {field}: {form_data[field]}")

        print("\n🎬 Starting automation...\n")

        max_actions = 30
        stuck_count = 0

        while self.action_count < max_actions and len(self.completed_fields) < len(fields_to_fill):

            print(f"\n{'='*50}")
            print(f"📍 Action #{self.action_count + 1}")
            print(f"{'='*50}")

            # Take screenshot
            screenshot_path = self.take_screenshot()

            # Process with OmniParser
            df = self.process_with_omniparser(screenshot_path)

            if df is None or df.empty:
                print("  ⚠️ No elements detected")
                break

            print(f"  📊 Progress: {len(self.completed_fields)}/{len(fields_to_fill)} fields completed")

            action_taken = False

            # 1. Check for popups first
            popup = self.check_for_popup(df)
            if popup:
                print(f"  🚫 Dismissing popup: {popup['content']}")
                click_element(popup, self.screen_width, self.screen_height)
                action_taken = True

            # 2. Try to fill next uncompleted field
            if not action_taken:
                for field_name in fields_to_fill:
                    if field_name not in self.completed_fields:
                        value = form_data[field_name]

                        # Find element for this field
                        element = self.find_field_element(df, field_name)

                        if element:
                            success = self.execute_field_action(element, field_name, value)
                            if success:
                                action_taken = True
                                stuck_count = 0
                                break
                        else:
                            print(f"  ⚠️ Could not find element for field: {field_name}")

            # 3. If all fields complete, look for submit button
            if not action_taken and len(self.completed_fields) == len(fields_to_fill):
                submit_btn = self.find_submit_button(df)
                if submit_btn:
                    print(f"  ✅ All fields complete. Submitting form...")
                    click_element(submit_btn, self.screen_width, self.screen_height)
                    action_taken = True
                    time.sleep(2)
                    break

            if not action_taken:
                stuck_count += 1
                if stuck_count > 3:
                    print("\n⚠️ Unable to make progress, stopping")
                    break

            self.action_count += 1
            time.sleep(1)  # Wait between actions

        # Final summary
        print("\n" + "="*60)
        print("📊 AUTOMATION SUMMARY")
        print("="*60)
        print(f"  Total actions taken: {self.action_count}")
        print(f"  Fields completed: {len(self.completed_fields)}/{len(fields_to_fill)}")

        if self.completed_fields:
            print("\n  ✅ Completed fields:")
            for field in self.completed_fields:
                print(f"    • {field}: {form_data[field]}")

        if len(self.completed_fields) < len(fields_to_fill):
            missing = [f for f in fields_to_fill if f not in self.completed_fields]
            print("\n  ❌ Missing fields:")
            for field in missing:
                print(f"    • {field}")

        print(f"\n📁 Results saved to: {self.output_dir}")

        return len(self.completed_fields) == len(fields_to_fill)


def main():
    parser = argparse.ArgumentParser(
        description='Rule-Based Form Automation using OmniParser'
    )
    parser.add_argument('--schema', type=str, help='Path to schema.json')
    parser.add_argument('--output-dir', type=str, help='Output directory')
    parser.add_argument('--delay', type=int, default=3, help='Initial delay before starting')

    args = parser.parse_args()

    # Setup paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    schema_path = args.schema or os.path.join(script_dir, 'schema.json')

    if not os.path.exists(schema_path):
        print(f"❌ Schema file not found: {schema_path}")
        return 1

    # Output directory
    if args.output_dir:
        output_dir = args.output_dir
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = os.path.join(script_dir, f"rule_based_output_{timestamp}")

    # Initial delay
    if args.delay > 0:
        print(f"\n⏱️  Starting in {args.delay} seconds...")
        print("   Switch to your browser with the form!")
        for i in range(args.delay, 0, -1):
            print(f"   {i}...", end='', flush=True)
            time.sleep(1)
        print()

    # Run automation
    automation = RuleBasedFormAutomation(schema_path, output_dir)
    success = automation.run()

    if success:
        print("\n✅ AUTOMATION COMPLETED SUCCESSFULLY!")
        return 0
    else:
        print("\n⚠️ AUTOMATION PARTIALLY COMPLETE")
        return 1


if __name__ == "__main__":
    sys.exit(main())