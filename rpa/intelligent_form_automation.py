#!/usr/bin/env python3
"""
Intelligent Form Automation with AI-Powered Decision Making
- Takes screenshot after each action
- Uses AI to understand form state and decide next action
- Processes with OmniParser for element detection
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
AI_URL = "http://localhost:1234/v1/chat/completions"
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.5

# Import functions from form_automation
from form_automation import (
    load_schema,
    get_screen_size,
    convert_bbox_to_screen,
    click_element,
    type_text
)

def parse_bbox_string(bbox_data):
    """Parse bbox string or list into list of floats"""
    if isinstance(bbox_data, list):
        return bbox_data
    if isinstance(bbox_data, str):
        # Remove brackets and split
        bbox_str = bbox_data.strip('[]')
        return [float(x.strip()) for x in bbox_str.split(',')]
    return bbox_data


class IntelligentFormAutomation:
    def __init__(self, schema_path: str, output_dir: str):
        self.schema = load_schema(schema_path)
        self.output_dir = output_dir
        self.screen_width, self.screen_height = get_screen_size()
        self.action_count = 0
        self.completed_fields = []
        self.action_history = []

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
                if 'bbox' in df.columns and df['bbox'].dtype == object:
                    df['bbox_parsed'] = df['bbox'].apply(parse_bbox_string)

                # Save CSV
                csv_path = os.path.join(self.parsed_dir, f"elements_{self.action_count:03d}.csv")
                df.to_csv(csv_path, index=False)

                print(f"    ✓ Detected {len(df)} elements")
                return df

            return None

        except Exception as e:
            print(f"    ❌ Error: {e}")
            return None

    def match_field_to_element(self, df: pd.DataFrame, field_name: str, field_value: Any) -> Dict[str, Any]:
        """Use rule-based matching to find the element for a given field"""

        # Rule 1: Direct label match
        for _, row in df.iterrows():
            content = row['content'].strip().lower()
            field_lower = field_name.lower()

            # Check for exact or partial match
            if field_lower in content or content in field_lower:
                # If it's a label, find the nearest input field
                if not row.get('interactivity'):
                    # Find closest interactive element below this label
                    label_y = parse_bbox_string(row['bbox'])[1]
                    interactive_df = df[df['interactivity'] == True]
                    candidates = interactive_df[interactive_df['bbox'].apply(
                        lambda x: parse_bbox_string(x)[1] > label_y
                    )]
                    if not candidates.empty:
                        element = candidates.iloc[0].to_dict()
                        return {
                            "action_type": "type",
                            "element": element,
                            "value": field_value
                        }
                else:
                    # It's already an interactive element
                    return {
                        "action_type": "type",
                        "element": row.to_dict(),
                        "value": field_value
                    }

        # Rule 2: Try fuzzy matching with common variations
        field_variations = [
            field_name.lower(),
            field_name.lower().replace('_', ' '),
            field_name.lower().replace('-', ' '),
            field_name.lower().replace('name', ''),
            field_name.lower().replace('number', ''),
            field_name.lower().replace('phone', 'tel')
        ]

        for variation in field_variations:
            for _, row in df.iterrows():
                content = row['content'].strip().lower()
                if variation in content or any(word in content for word in variation.split()):
                    if not row.get('interactivity'):
                        # Find nearest input
                        label_y = parse_bbox_string(row['bbox'])[1]
                        interactive_df = df[df['interactivity'] == True]
                        candidates = interactive_df[interactive_df['bbox'].apply(
                            lambda x: parse_bbox_string(x)[1] > label_y
                        )]
                        if not candidates.empty:
                            element = candidates.iloc[0].to_dict()
                            return {
                                "action_type": "type",
                                "element": element,
                                "value": field_value
                            }
                    else:
                        return {
                            "action_type": "type",
                            "element": row.to_dict(),
                            "value": field_value
                        }

        # Rule 3: Use AI only as last resort for complex matching
        if self.use_ai_matching:
            return self.ai_match_field(df, field_name, field_value)

        return None

    def ai_match_field(self, df: pd.DataFrame, field_name: str, field_value: Any) -> Dict[str, Any]:
        """Use AI only to match field name to detected elements"""

        elements = df[['content', 'type', 'interactivity', 'bbox']].to_dict('records')

        prompt = f"""Given these detected UI elements, which element corresponds to the field '{field_name}'?
        Elements: {json.dumps(elements[:20], indent=2)}

        Respond with just the index number (0-based) of the matching element, or -1 if none match."""

        try:
            response = requests.post(
                AI_URL,
                json={
                    "model": "google/gemma-3n-e4b",
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 10,
                    "stream": False
                },
                timeout=10
            )

            if response.status_code == 200:
                ai_response = response.json()
                content = ai_response['choices'][0]['message']['content'].strip()

                try:
                    idx = int(content)
                    if 0 <= idx < len(elements):
                        element = elements[idx]
                        return {
                            "action_type": "type",
                            "element": element,
                            "value": field_value
                        }
                except:
                    pass
        except:
            pass

        return None

    def simple_decision_logic(self, df: pd.DataFrame, remaining_fields: Dict[str, Any]) -> Dict[str, Any]:
        """Simple fallback logic if AI is not available"""

        # Check for popups first
        dismiss_words = ['dismiss', 'close', '×', 'x']
        for word in dismiss_words:
            matches = df[df['content'].str.lower().str.contains(word, na=False)]
            if not matches.empty and matches.iloc[0].get('interactivity'):
                return {
                    "action_type": "dismiss_popup",
                    "target_element": matches.iloc[0]['content'],
                    "reasoning": "Dismissing popup"
                }

        # Try to fill next field
        for field_name, field_info in remaining_fields.items():
            # Look for field in form
            matches = df[df['content'].str.contains(field_name, case=False, na=False)]
            if not matches.empty:
                return {
                    "field_to_fill": field_name,
                    "action_type": "type",
                    "target_element": field_name,
                    "value_to_enter": field_info['value'],
                    "reasoning": f"Found field {field_name}"
                }

        # Look for submit button if all done
        if len(remaining_fields) == 0:
            submit_matches = df[df['content'].str.lower().str.contains('submit', na=False)]
            if not submit_matches.empty:
                return {
                    "action_type": "submit",
                    "target_element": submit_matches.iloc[0]['content'],
                    "reasoning": "All fields complete, submitting form"
                }

        return {
            "action_type": "none",
            "reasoning": "No action determined"
        }

    def execute_action(self, df: pd.DataFrame, action: Dict[str, Any]) -> bool:
        """Execute the action determined by AI"""

        action_type = action.get('action_type', 'none')

        if action_type == 'none':
            return False

        print(f"\n  🎯 Executing: {action_type}")

        # Find target element
        target = action.get('target_element', '')
        element = None

        # Search for element
        for _, row in df.iterrows():
            if target.lower() in row['content'].lower():
                element = row.to_dict()
                break

        if not element and action_type not in ['none', 'wait']:
            print(f"  ⚠️ Could not find element: {target}")
            return False

        # Execute based on type
        if action_type == 'dismiss_popup':
            if element:
                click_element(element, self.screen_width, self.screen_height)
                print(f"  ✓ Dismissed popup")
                return True

        elif action_type == 'click':
            if element:
                click_element(element, self.screen_width, self.screen_height)
                print(f"  ✓ Clicked: {element['content']}")
                return True

        elif action_type == 'type':
            # Get field name and value FIRST
            field_name = action.get('field_to_fill')
            value = action.get('value_to_enter', '')

            print(f"  📝 Filling field: {field_name} with value: {value}")

            # First click on field or nearby input
            if element:
                # If it's a label, find nearby input
                if not element.get('interactivity'):
                    print(f"  🔍 Label found, looking for input field...")
                    # Look for interactive element nearby
                    interactive = df[df['interactivity'] == True]
                    if not interactive.empty:
                        # Use first interactive element after this label
                        element_y = parse_bbox_string(element['bbox'])[1]
                        candidates = interactive[interactive['bbox'].apply(
                            lambda x: parse_bbox_string(x)[1] > element_y
                        )]
                        if not candidates.empty:
                            element = candidates.iloc[0].to_dict()
                            print(f"  ✓ Found input field: {element['content']}")

                # Click on the field
                click_element(element, self.screen_width, self.screen_height)
                time.sleep(0.5)  # Give more time for field to focus

                # Now type the new value (type_text will handle clearing)
                if value:
                    # Make sure we have string value
                    value_str = str(value)
                    print(f"  ⌨️  Typing: '{value_str}'")

                    # Use the imported type_text function which handles clearing properly
                    type_text(value_str, clear_first=True)

                    print(f"  ✓ Typed: {value_str}")
                    time.sleep(0.3)  # Wait for typing to complete

                    # Mark field as completed - IMPORTANT
                    if field_name and field_name not in self.completed_fields:
                        self.completed_fields.append(field_name)
                        print(f"  ✅ Marked {field_name} as completed")

                    return True
                else:
                    print(f"  ⚠️ No value to type for {field_name}")
                    return False

        elif action_type == 'submit':
            if element:
                click_element(element, self.screen_width, self.screen_height)
                print(f"  ✓ Submitted form")
                return True

        elif action_type == 'select' or action_type == 'check':
            if element:
                click_element(element, self.screen_width, self.screen_height)
                print(f"  ✓ Selected/Checked: {element['content']}")

                field_name = action.get('field_to_fill')
                if field_name:
                    self.completed_fields.append(field_name)

                return True

        return False

    def run(self):
        """Main automation loop"""
        print("\n" + "="*60)
        print("🤖 INTELLIGENT FORM AUTOMATION")
        print("="*60)

        # Get remaining fields from schema
        form_data = self.schema.get('form_data', {})
        field_types = self.schema.get('field_types', {})

        remaining_fields = {}
        for field_name, value in form_data.items():
            remaining_fields[field_name] = {
                'value': value,
                'type': field_types.get(field_name, 'text')
            }

        print(f"\n📋 Total fields to fill: {len(remaining_fields)}")
        print("🎬 Starting automation...\n")

        max_actions = 30  # Prevent infinite loops
        no_action_count = 0

        while self.action_count < max_actions and (remaining_fields or self.action_count < 5):
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

            # Remove completed fields from remaining
            for field in self.completed_fields:
                remaining_fields.pop(field, None)

            print(f"  📊 Status: {len(self.completed_fields)} completed, {len(remaining_fields)} remaining")

            # Get next action from AI
            print("\n  🤔 Determining next action...")
            action = self.ask_ai_for_next_action(df, remaining_fields)

            # Execute action
            success = self.execute_action(df, action)

            if not success:
                no_action_count += 1
                if no_action_count > 3:
                    print("\n⚠️ No valid actions for 3 attempts, stopping")
                    break
            else:
                no_action_count = 0
                self.action_history.append(action)

            self.action_count += 1

            # Wait before next action
            time.sleep(1)

            # Check if all fields are complete
            if len(remaining_fields) == 0 and 'submit' in str(action.get('action_type', '')).lower():
                print("\n✅ Form submitted successfully!")
                break

        # Final summary
        print("\n" + "="*60)
        print("📊 AUTOMATION SUMMARY")
        print("="*60)
        print(f"  Total actions taken: {self.action_count}")
        print(f"  Fields completed: {len(self.completed_fields)}/{len(form_data)}")
        print(f"  Screenshots saved: {self.action_count}")

        if self.completed_fields:
            print("\n  ✅ Completed fields:")
            for field in self.completed_fields:
                print(f"    • {field}")

        print(f"\n📁 All results saved to: {self.output_dir}")

        return len(self.completed_fields) == len(form_data)


def main():
    parser = argparse.ArgumentParser(
        description='Intelligent Form Automation with AI decision making'
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
        output_dir = os.path.join(script_dir, f"intelligent_output_{timestamp}")

    # Initial delay
    if args.delay > 0:
        print(f"\n⏱️  Starting in {args.delay} seconds...")
        print("   Switch to your browser with the form!")
        for i in range(args.delay, 0, -1):
            print(f"   {i}...", end='', flush=True)
            time.sleep(1)
        print()

    # Run automation
    automation = IntelligentFormAutomation(schema_path, output_dir)
    success = automation.run()

    if success:
        print("\n✅ AUTOMATION COMPLETED SUCCESSFULLY!")
        return 0
    else:
        print("\n⚠️ AUTOMATION PARTIALLY COMPLETE")
        return 1


if __name__ == "__main__":
    sys.exit(main())