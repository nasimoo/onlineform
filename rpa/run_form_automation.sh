#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Form Automation Script${NC}"
echo "========================"

# Check if output directory exists
OUTPUT_DIR=$(ls -d output_* 2>/dev/null | tail -1)

if [ -z "$OUTPUT_DIR" ]; then
    echo -e "${RED}Error: No output directory found${NC}"
    echo "Please run ./run_omniparser.sh first to process a screenshot"
    exit 1
fi

echo -e "${YELLOW}Using output from: ${OUTPUT_DIR}${NC}"

# Check if bbox.csv exists
if [ ! -f "${OUTPUT_DIR}/bbox.csv" ]; then
    echo -e "${RED}Error: bbox.csv not found in ${OUTPUT_DIR}${NC}"
    exit 1
fi

echo ""
echo "This script will automate form filling using the processed screenshot data."
echo -e "${YELLOW}Make sure your browser is open with the form visible!${NC}"
echo ""
echo "The automation will start in 5 seconds..."
echo "Press Ctrl+C to cancel"

for i in 5 4 3 2 1; do
    echo -n "$i... "
    sleep 1
done
echo ""

# Run the Python automation script
python3 form_automation.py --output-dir "${OUTPUT_DIR}"