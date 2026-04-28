#!/bin/bash

# oc-router Installation Script
# Installs oc-router globally

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}🚀 Installing oc-router...${NC}"

# Get repository root directory (relative to script location)
REPO_ROOT=$(cd "$(dirname "$0")" && pwd)

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    echo -e "${YELLOW}   Download from: https://nodejs.org/${NC}"
    exit 1
fi

# Check Node version (require 18+)
NODE_VERSION=$(node -v)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/^v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${RED}❌ Node.js $NODE_VERSION is too old. oc-router requires Node.js 18+.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $NODE_VERSION found${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm v$NPM_VERSION found${NC}"

# Build the project first
echo -e "${CYAN}🔨 Building oc-router...${NC}"
cd "$REPO_ROOT"
if [ -f "package.json" ]; then
    npm install --loglevel=error
    if npm run build --silent 2>/dev/null; then
        echo -e "${GREEN}✓ Build successful${NC}"
    else
        echo -e "${YELLOW}⚠ Build step skipped or failed (continuing with install)${NC}"
    fi
fi

# Install globally
echo -e "${CYAN}📦 Installing oc-router globally...${NC}"
npm install -g .

# Verify installation
if command -v oc-router &> /dev/null; then
    INSTALLED_VERSION=$(oc-router --version 2>/dev/null || echo "unknown")
    echo ""
    echo -e "${GREEN}${BOLD}✅ oc-router v$INSTALLED_VERSION installed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}To verify, run:${NC} oc-router --version"
    echo -e "${YELLOW}To start setup, run:${NC} oc-router init --global"
else
    echo -e "${GREEN}${BOLD}✅ oc-router installed successfully!${NC}"
    echo -e "${YELLOW}Note: You may need to restart your shell or reload your PATH.${NC}"
    echo ""
    echo -e "${YELLOW}To verify, run:${NC} oc-router --version"
    echo -e "${YELLOW}To start setup, run:${NC} oc-router init --global"
fi