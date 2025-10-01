#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}║        🤖  COMPREHENSIVE FORM AUTOMATION TOOL  🤖         ║${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}This tool will:${NC}"
echo "  1. Take a screenshot of your form"
echo "  2. Analyze it with OmniParser to detect UI elements"
echo "  3. Automatically fill and submit the form"
echo ""

# Check if OmniParser is running
echo -e "${YELLOW}Checking OmniParser service...${NC}"
if curl -s -f -o /dev/null "http://localhost:8080"; then
    echo -e "${GREEN}✓ OmniParser is running${NC}"
else
    echo -e "${RED}✗ OmniParser is not running!${NC}"
    echo ""
    echo "Please start OmniParser first:"
    echo "  cd /Users/nasimo/Documents/omniparserscreenshot"
    echo "  python app_local.py"
    echo ""
    exit 1
fi

# Check if schema.json exists
if [ ! -f "schema.json" ]; then
    echo -e "${RED}✗ schema.json not found!${NC}"
    echo "Please ensure schema.json exists in the current directory"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 Using schema: schema.json${NC}"
echo -e "${YELLOW}📁 Output will be saved to: auto_output_[timestamp]${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}INSTRUCTIONS:${NC}"
echo "  1. Open your browser with the form at localhost:3000"
echo "  2. Make sure the form is fully visible on screen"
echo "  3. The tool will take a screenshot in 5 seconds"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

read -p "Press ENTER to start automation (or Ctrl+C to cancel)..."

echo ""
echo -e "${GREEN}Starting automation...${NC}"
echo ""

# Run the comprehensive automation
python3 auto_complete_form.py --delay 5

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║            ✅  AUTOMATION COMPLETED SUCCESSFULLY!          ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
else
    echo ""
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║          ⚠️   AUTOMATION COMPLETED WITH WARNINGS          ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
fi