#!/usr/bin/env python3
"""
Form Automation Script
Reads bbox.csv from OmniParser output and automates form filling using schema.json
"""

import os
import sys
import time
import json
import pandas as pd
import pyautogui
import argparse
from typing import Tuple, List, Dict, Any, Union

# Safety settings for pyautogui
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.3  # Pause between actions


def load_schema(schema_path: str = None) -> Dict[str, Any]:
    """Load form schema from JSON file"""
    if schema_path is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        schema_path = os.path.join(script_dir, 'schema.json')

    if not os.path.exists(schema_path):
        raise FileNotFoundError(f"Schema file not found: {schema_path}")

    with open(schema_path, 'r') as f:
        schema = json.load(f)

    print(f"Loaded schema with {len(schema.get('form_data', {}))} fields")
    return schema


def get_screen_size() -> Tuple[int, int]:
    """Get current screen dimensions"""
    return pyautogui.size()


def convert_bbox_to_screen(bbox: List[float], screen_width: int, screen_height: int) -> Tuple[int, int]:
    """
    Convert normalized bbox coordinates to screen coordinates
    bbox format: [x1, y1, x2, y2] in normalized values (0-1)
    Returns: (center_x, center_y) in screen pixels
    """
    x1, y1, x2, y2 = bbox

    # Calculate center point
    center_x_norm = (x1 + x2) / 2
    center_y_norm = (y1 + y2) / 2

    # Convert to screen coordinates
    center_x = int(center_x_norm * screen_width)
    center_y = int(center_y_norm * screen_height)

    return center_x, center_y


def parse_bbox_string(bbox_str: str) -> List[float]:
    """Parse bbox string from CSV into list of floats"""
    # Remove brackets and split
    bbox_str = bbox_str.strip('[]')
    return [float(x.strip()) for x in bbox_str.split(',')]


def load_elements(csv_path: str) -> pd.DataFrame:
    """Load and parse elements from bbox.csv"""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} elements from {csv_path}")

    # Parse bbox strings if they're stored as strings
    if 'bbox' in df.columns and df['bbox'].dtype == object:
        df['bbox_parsed'] = df['bbox'].apply(parse_bbox_string)

    return df


def find_element_by_content(df: pd.DataFrame, content: str, element_type: str = None,
                            fuzzy: bool = False) -> Union[Dict[str, Any], None]:
    """Find element by content text and optionally by type"""

    # Clean the content for matching
    content_clean = content.lower().strip()

    # Search for exact match first
    mask = df['content'].str.lower().str.strip() == content_clean

    # If no exact match and fuzzy is allowed, try contains
    if not mask.any() and fuzzy:
        mask = df['content'].str.lower().str.contains(content_clean, na=False, regex=False)

    # If still no match, try without trailing spaces in the dataframe
    if not mask.any():
        # Some OCR results have trailing spaces
        mask = df['content'].str.strip().str.lower() == content_clean

    # Filter by type if specified
    if element_type and mask.any():
        type_mask = df['type'] == element_type
        mask = mask & type_mask

    if not mask.any():
        return None

    # Return first match
    element = df[mask].iloc[0]
    return element.to_dict()


def find_input_field_near_label(df: pd.DataFrame, label_element: Dict[str, Any]) -> Union[Dict[str, Any], None]:
    """Find an interactive input field near a text label"""

    if not label_element:
        return None

    label_bbox = label_element.get('bbox_parsed', parse_bbox_string(label_element.get('bbox')))
    label_x1, label_y1, label_x2, label_y2 = label_bbox

    # Look for interactive elements
    interactive_df = df[df['interactivity'] == True].copy()

    if interactive_df.empty:
        return None

    # Calculate distances from label to each interactive element
    def calculate_distance(row):
        bbox = row.get('bbox_parsed', parse_bbox_string(row.get('bbox')))
        elem_x1, elem_y1, elem_x2, elem_y2 = bbox

        # Calculate distance from label bottom-right to element top-left
        # This favors elements to the right or below the label
        dx = max(0, elem_x1 - label_x2)
        dy = max(0, elem_y1 - label_y2)

        # Also check if element is directly below
        if elem_y1 > label_y1 and elem_x1 <= label_x2 and elem_x2 >= label_x1:
            # Element is below and horizontally overlapping
            return dy

        return (dx ** 2 + dy ** 2) ** 0.5

    interactive_df['distance'] = interactive_df.apply(calculate_distance, axis=1)

    # Get the closest interactive element
    closest = interactive_df.nsmallest(1, 'distance')

    if not closest.empty:
        return closest.iloc[0].to_dict()

    return None


def click_element(element: Dict[str, Any], screen_width: int, screen_height: int):
    """Click on an element"""
    bbox = element.get('bbox_parsed', element.get('bbox'))
    if isinstance(bbox, str):
        bbox = parse_bbox_string(bbox)

    x, y = convert_bbox_to_screen(bbox, screen_width, screen_height)

    print(f"  → Clicking at ({x}, {y})")
    pyautogui.click(x, y)
    time.sleep(0.2)


def type_text(text: str, clear_first: bool = True):
    """Type text into the currently focused field"""
    if clear_first:
        # Select all and delete (Mac: cmd+a, Windows/Linux: ctrl+a)
        if sys.platform == 'darwin':
            pyautogui.hotkey('cmd', 'a')
        else:
            pyautogui.hotkey('ctrl', 'a')
        time.sleep(0.1)
        pyautogui.press('delete')
        time.sleep(0.1)

    print(f"  → Typing: {text}")
    # Use write() instead of typewrite() for better compatibility
    pyautogui.write(text, interval=0.02)
    time.sleep(0.2)


def handle_checkbox_group(df: pd.DataFrame, field_name: str, values: List[str],
                         screen_width: int, screen_height: int):
    """Handle checkbox group selection"""
    print(f"  → Handling checkbox group with values: {values}")

    for value in values:
        # Try to find the checkbox option by its label
        for label_text in [value.capitalize(), value.upper(), value.lower(), value]:
            element = find_element_by_content(df, label_text, fuzzy=True)
            if element and element.get('interactivity'):
                click_element(element, screen_width, screen_height)
                break


def handle_radio_group(df: pd.DataFrame, field_name: str, value: str,
                       screen_width: int, screen_height: int, options: Dict[str, str] = None):
    """Handle radio button selection"""
    print(f"  → Selecting radio option: {value}")

    # Try to find the radio option
    option_label = options.get(value, value) if options else value

    for label_text in [option_label, value.capitalize(), value.upper(), value.lower()]:
        element = find_element_by_content(df, label_text, fuzzy=True)
        if element and element.get('interactivity'):
            click_element(element, screen_width, screen_height)
            return


def handle_select_dropdown(df: pd.DataFrame, field_element: Dict[str, Any], value: str,
                          screen_width: int, screen_height: int, options: Dict[str, str] = None):
    """Handle dropdown selection"""
    print(f"  → Selecting dropdown option: {value}")

    # Click to open dropdown
    click_element(field_element, screen_width, screen_height)
    time.sleep(0.5)

    # Look for the option in the dropdown
    option_label = options.get(value, value) if options else value

    # Try to find and click the option
    for label_text in [option_label, value]:
        element = find_element_by_content(df, label_text, fuzzy=True)
        if element:
            click_element(element, screen_width, screen_height)
            return

    # If not found, try typing to search
    pyautogui.typewrite(option_label[:3], interval=0.1)
    time.sleep(0.3)
    pyautogui.press('enter')


def handle_checkbox(element: Dict[str, Any], value: bool, screen_width: int, screen_height: int):
    """Handle single checkbox"""
    if value:
        print(f"  → Checking checkbox")
        click_element(element, screen_width, screen_height)


def dismiss_popup(df: pd.DataFrame, screen_width: int, screen_height: int):
    """Try to dismiss any popup that might be present"""
    # Look for dismiss/close buttons
    dismiss_words = ['dismiss', 'close', '×', 'x', 'ok', 'got it', 'accept']

    for word in dismiss_words:
        element = find_element_by_content(df, word, fuzzy=True)
        if element and element.get('interactivity'):
            print(f"Found popup dismiss button: {element.get('content')}")
            click_element(element, screen_width, screen_height)
            time.sleep(0.5)
            return True

    # Try pressing ESC as fallback
    pyautogui.press('esc')
    return False


def detect_visible_fields(df: pd.DataFrame, schema: Dict[str, Any]) -> List[str]:
    """Detect which fields from the schema are actually visible on the form"""
    form_data = schema.get('form_data', {})
    visible_fields = []

    for field_name in form_data.keys():
        # Check if field is visible
        element = find_element_by_content(df, field_name)
        if not element:
            element = find_element_by_content(df, field_name, fuzzy=True)

        if element:
            visible_fields.append(field_name)

    return visible_fields


def fill_form(csv_path: str, schema_path: str = None):
    """
    Automate form filling using bbox data and schema

    Args:
        csv_path: Path to bbox.csv file
        schema_path: Path to schema.json file
    """
    # Load schema and elements
    schema = load_schema(schema_path)
    df = load_elements(csv_path)
    screen_width, screen_height = get_screen_size()

    form_data = schema.get('form_data', {})
    field_types = schema.get('field_types', {})
    options = schema.get('options', {})

    print(f"\nScreen size: {screen_width}x{screen_height}")

    # Detect which fields are visible
    print("\n" + "="*50)
    print("Detecting visible form fields...")
    print("="*50)
    visible_field_names = detect_visible_fields(df, schema)
    print(f"\n📋 Detected {len(visible_field_names)} visible fields out of {len(form_data)} in schema:")
    for field in visible_field_names:
        print(f"  • {field}")

    print("\n" + "="*50)
    print("Starting form automation in 3 seconds...")
    print("Move mouse to upper-left corner to abort!")
    print("="*50 + "\n")
    time.sleep(3)

    # Check for and dismiss any popup first
    dismiss_popup(df, screen_width, screen_height)

    # Process each form field
    completed_fields = []
    skipped_fields = []
    failed_fields = []

    for field_name, value in form_data.items():
        print(f"\n📝 Looking for: {field_name}")

        field_type = field_types.get(field_name, 'text')
        field_options = options.get(field_name, {})

        try:
            # Find the field element
            element = find_element_by_content(df, field_name)

            if not element:
                # Try with fuzzy matching
                element = find_element_by_content(df, field_name, fuzzy=True)

            if element:
                print(f"  ✓ Found field: {element.get('content')}")

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
                            print(f"  ⚠ Could not find input field for {field_name}")
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
                        # Find the actual checkbox near the label
                        checkbox_element = find_input_field_near_label(df, element)
                        if checkbox_element:
                            handle_checkbox(checkbox_element, value, screen_width, screen_height)
                    completed_fields.append(field_name)

            else:
                print(f"  ⊘ Field not visible on form (skipping): {field_name}")
                skipped_fields.append(field_name)

        except Exception as e:
            print(f"  ❌ Error processing {field_name}: {e}")
            failed_fields.append(field_name)
            continue

    # Look for submit button
    print("\n" + "="*50)
    print("Looking for Submit button...")
    print("="*50)

    time.sleep(1)

    for submit_text in ['submit', 'Submit', 'SUBMIT', 'Send', 'send']:
        submit = find_element_by_content(df, submit_text, fuzzy=True)
        if submit and submit.get('interactivity'):
            print(f"✓ Found Submit button: {submit.get('content')}")
            click_element(submit, screen_width, screen_height)
            print("✓ Form submitted!")
            break
    else:
        print("⚠ Could not find Submit button")

    # Print summary
    print("\n" + "="*50)
    print("AUTOMATION SUMMARY")
    print("="*50)

    total_fields_in_schema = len(form_data)
    visible_fields = len(completed_fields) + len(failed_fields)

    print(f"📊 Form Status:")
    print(f"  Total fields in schema: {total_fields_in_schema}")
    print(f"  Fields visible on form: {visible_fields}")
    print(f"  Fields not shown: {len(skipped_fields)}")

    print(f"\n✓ Successfully filled: {len(completed_fields)}/{visible_fields} visible fields")
    if completed_fields:
        for field in completed_fields:
            print(f"  ✓ {field}")

    if skipped_fields:
        print(f"\n⊘ Fields not visible (skipped): {len(skipped_fields)}")
        for field in skipped_fields:
            print(f"  ⊘ {field}")

    if failed_fields:
        print(f"\n❌ Failed to fill: {len(failed_fields)}")
        for field in failed_fields:
            print(f"  ✗ {field}")

    # Success rate calculation
    if visible_fields > 0:
        success_rate = (len(completed_fields) / visible_fields) * 100
        print(f"\n📈 Success Rate: {success_rate:.1f}% of visible fields filled")


def main():
    parser = argparse.ArgumentParser(description='Automate form filling using OmniParser bbox data')
    parser.add_argument('--csv', type=str, help='Path to bbox.csv file')
    parser.add_argument('--output-dir', type=str, help='Path to OmniParser output directory')
    parser.add_argument('--schema', type=str, help='Path to schema.json file')

    args = parser.parse_args()

    # Determine paths
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # CSV path
    csv_path = None
    if args.csv:
        csv_path = args.csv
    elif args.output_dir:
        csv_path = os.path.join(args.output_dir, 'bbox.csv')
    else:
        # Try to find the most recent output directory
        output_dirs = [d for d in os.listdir(script_dir) if d.startswith('output_')]
        if output_dirs:
            latest_dir = sorted(output_dirs)[-1]
            csv_path = os.path.join(script_dir, latest_dir, 'bbox.csv')
            print(f"Using latest output: {latest_dir}")

    if not csv_path or not os.path.exists(csv_path):
        print("Error: Could not find bbox.csv file")
        print("Please run ./run_omniparser.sh first or specify --csv path")
        sys.exit(1)

    # Schema path
    schema_path = args.schema if args.schema else os.path.join(script_dir, 'schema.json')

    print(f"📁 Using CSV: {csv_path}")
    print(f"📋 Using Schema: {schema_path}")

    try:
        fill_form(csv_path, schema_path)
        print("\n✅ Form automation completed!")
    except Exception as e:
        print(f"\n❌ Error during automation: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()