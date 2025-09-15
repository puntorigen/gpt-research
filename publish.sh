#!/bin/bash

# GPT Research NPM Publishing Script
# This script prepares and publishes the package to NPM

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 GPT Research NPM Publishing Script${NC}"
echo "========================================"

# Check if user is logged into NPM
echo -e "\n${YELLOW}📝 Checking NPM login status...${NC}"
if ! npm whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged into NPM. Please run: npm login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Logged in as: $(npm whoami)${NC}"

# Clean previous builds
echo -e "\n${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf dist/
rm -f *.tsbuildinfo

# Install dependencies
echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
npm ci

# Run tests
echo -e "\n${YELLOW}🧪 Running tests...${NC}"
npm test

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed. Fix tests before publishing.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All tests passed!${NC}"

# Build the project
echo -e "\n${YELLOW}🔨 Building project...${NC}"
npm run build

# Check build output
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed. dist/ directory not found.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful!${NC}"

# Run a dry-run to see what will be published
echo -e "\n${YELLOW}📋 Files to be published:${NC}"
npm pack --dry-run

# Ask for confirmation
echo -e "\n${YELLOW}⚠️  Ready to publish to NPM${NC}"
echo "Package name: $(node -p "require('./package.json').name")"
echo "Version: $(node -p "require('./package.json').version")"
read -p "Continue with publishing? (y/n) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Publishing cancelled.${NC}"
    exit 0
fi

# Publish to NPM
echo -e "\n${YELLOW}🚀 Publishing to NPM...${NC}"
npm publish

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}🎉 Successfully published!${NC}"
    echo -e "View at: https://www.npmjs.com/package/$(node -p "require('./package.json').name")"
    echo -e "\nNext steps:"
    echo -e "  1. Create a git tag: git tag v$(node -p "require('./package.json').version")"
    echo -e "  2. Push the tag: git push origin v$(node -p "require('./package.json').version")"
    echo -e "  3. Create a GitHub release"
else
    echo -e "${RED}❌ Publishing failed!${NC}"
    exit 1
fi
