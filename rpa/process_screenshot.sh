#!/bin/bash

# Get the current working directory
OUTPUT_DIR=$(pwd)

# Check if screenshots folder exists
if [ ! -d "${OUTPUT_DIR}/screenshots" ]; then
    echo "Error: screenshots folder not found in current directory"
    echo "Please create a 'screenshots' folder and add your screenshot"
    exit 1
fi

# Find the first image in screenshots folder
IMG=$(ls ${OUTPUT_DIR}/screenshots/*.png ${OUTPUT_DIR}/screenshots/*.jpg ${OUTPUT_DIR}/screenshots/*.jpeg 2>/dev/null | head -1)

if [ -z "$IMG" ]; then
    echo "Error: No image found in screenshots folder"
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

# Create output folder in current directory
mkdir -p "${OUTPUT_DIR}/${PREFIX}"

# Save the raw response
echo "$RESPONSE" > "${OUTPUT_DIR}/${PREFIX}/response.json"

# Extract and save parsed elements
echo "$RESPONSE" | python3 -c "
import json
import sys
import os
import shutil

data = json.load(sys.stdin)

# Save parsed elements
with open('${OUTPUT_DIR}/${PREFIX}/elements.json', 'w') as f:
    json.dump(data.get('parsed_elements', []), f, indent=2)

# Copy files from local_store if they exist
if 'local_annotated_image_path' in data and data['local_annotated_image_path']:
    src = data['local_annotated_image_path']
    if os.path.exists(src):
        shutil.copy2(src, '${OUTPUT_DIR}/${PREFIX}/annotated.png')

if 'local_raw_image_path' in data and data['local_raw_image_path']:
    src = data['local_raw_image_path']
    if os.path.exists(src):
        shutil.copy2(src, '${OUTPUT_DIR}/${PREFIX}/raw.png')

if 'local_csv_path' in data and data['local_csv_path']:
    src = data['local_csv_path']
    if os.path.exists(src):
        shutil.copy2(src, '${OUTPUT_DIR}/${PREFIX}/bbox.csv')

print(f'Found {len(data.get(\"parsed_elements\", []))} UI elements')
"

echo ""
echo "✓ Output saved in: ${OUTPUT_DIR}/${PREFIX}/"
echo "  - response.json (full API response)"
echo "  - elements.json (parsed UI elements)"
echo "  - annotated.png (annotated image)"
echo "  - bbox.csv (bounding boxes)"