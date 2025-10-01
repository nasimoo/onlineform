#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

clear

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🤖  INTELLIGENT FORM AUTOMATION WITH AI  🤖           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}This advanced automation will:${NC}"
echo "  • Take a screenshot after EACH action"
echo "  • Use AI to understand the form state"
echo "  • Intelligently decide the next action"
echo "  • Fill fields one by one with verification"
echo ""

# Check services
echo -e "${YELLOW}Checking required services...${NC}"

# Check OmniParser
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080" | grep -q "404\|200"; then
    echo -e "${GREEN}✓ OmniParser is running${NC}"
else
    echo -e "${RED}✗ OmniParser is not running!${NC}"
    echo "  Start with: python app_local.py"
    exit 1
fi

# Check AI service
if curl -s -f -o /dev/null "http://localhost:1234/v1/models"; then
    echo -e "${GREEN}✓ AI service is running${NC}"
else
    echo -e "${YELLOW}⚠ AI service not detected at localhost:1234${NC}"
    echo "  The automation will use fallback logic"
fi

# Check schema
if [ ! -f "schema.json" ]; then
    echo -e "${RED}✗ schema.json not found!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Ready to start intelligent automation${NC}"
echo ""
echo "  1. Make sure your form is visible at localhost:3000"
echo "  2. The automation will take multiple screenshots"
echo "  3. Each action will be verified before proceeding"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

read -p "Press ENTER to start (Ctrl+C to cancel)..."

echo ""
python3 intelligent_form_automation.py --delay 3

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Automation completed successfully!${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠ Automation completed with some issues${NC}"
fi