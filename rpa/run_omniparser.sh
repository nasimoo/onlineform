#!/bin/bash

# Get the current working directory
OUTPUT_DIR=$(pwd)

# Find the screenshot file
IMG=$(ls /Users/nasimo/Documents/omniparserscreenshot/Screenshot*2025-09-17*1.57.06*PM.png 2>/dev/null | head -1)

if [ -z "$IMG" ]; then
    echo "Error: Screenshot file not found"
    exit 1
fi

echo "Processing image: $IMG"

# Create a timestamp for unique naming
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PREFIX="output_${TIMESTAMP}"

# Encode the image to base64
ENCODED=$(openssl base64 -A -in "$IMG")

# Send the request to the API and save response
echo "Sending request to OmniParser API..."
RESPONSE=$(curl -s -X POST "http://localhost:8080/process_screenshot" \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$ENCODED\",\"target_s3_prefix\":\"$PREFIX\"}")

# Create output directory in current location
LOCAL_OUTPUT="${OUTPUT_DIR}/${PREFIX}"
mkdir -p "$LOCAL_OUTPUT"

# Save the raw response for debugging
echo "$RESPONSE" > "${LOCAL_OUTPUT}/response.json"

# Process response and copy files from local_store to current directory
echo "$RESPONSE" | python3 -c "
import json
import sys
import os
import shutil

data = json.load(sys.stdin)

# Save parsed elements
with open('${LOCAL_OUTPUT}/elements.json', 'w') as f:
    json.dump(data.get('parsed_elements', []), f, indent=2)

# Copy files from local_store to current directory
copied_files = []

if 'local_annotated_image_path' in data and data['local_annotated_image_path']:
    src = data['local_annotated_image_path']
    if os.path.exists(src):
        shutil.copy2(src, '${LOCAL_OUTPUT}/annotated.png')
        copied_files.append('annotated.png')

if 'local_raw_image_path' in data and data['local_raw_image_path']:
    src = data['local_raw_image_path']
    if os.path.exists(src):
        shutil.copy2(src, '${LOCAL_OUTPUT}/raw.png')
        copied_files.append('raw.png')

if 'local_csv_path' in data and data['local_csv_path']:
    src = data['local_csv_path']
    if os.path.exists(src):
        shutil.copy2(src, '${LOCAL_OUTPUT}/bbox.csv')
        copied_files.append('bbox.csv')

print(f'Found {len(data.get(\"parsed_elements\", []))} UI elements')
if copied_files:
    print(f'Copied files: {', '.join(copied_files)}')
"

echo ""
echo "✓ All output saved in: ${LOCAL_OUTPUT}/"
echo "  Files created:"
echo "  - response.json (full API response)"
echo "  - elements.json (parsed UI elements)"
echo "  - annotated.png (annotated image with bounding boxes)"
echo "  - raw.png (original image)"
echo "  - bbox.csv (bounding box coordinates)"