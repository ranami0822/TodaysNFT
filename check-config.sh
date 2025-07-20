#!/bin/bash

# Today's NFT Configuration Check Script
# Validates all components before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Today's NFT Configuration Check${NC}"
echo -e "${BLUE}===================================${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check file exists
file_exists() {
    [[ -f "$1" ]]
}

# Function to check directory exists
dir_exists() {
    [[ -d "$1" ]]
}

# Track overall status
ALL_CHECKS_PASSED=true

# Check system requirements
echo -e "${BLUE}📋 System Requirements${NC}"

if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js: ${NODE_VERSION}${NC}"
else
    echo -e "${RED}❌ Node.js not found${NC}"
    ALL_CHECKS_PASSED=false
fi

if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm: v${NPM_VERSION}${NC}"
else
    echo -e "${RED}❌ npm not found${NC}"
    ALL_CHECKS_PASSED=false
fi

if command_exists git; then
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}✅ Git: ${GIT_VERSION}${NC}"
else
    echo -e "${YELLOW}⚠️  Git not found (recommended for version control)${NC}"
fi

echo ""

# Check project structure
echo -e "${BLUE}📁 Project Structure${NC}"

required_dirs=(
    "today_nft_contract"
    "today_nft_auction" 
    "today_nft_ui"
)

for dir in "${required_dirs[@]}"; do
    if dir_exists "$dir"; then
        echo -e "${GREEN}✅ Directory: $dir${NC}"
    else
        echo -e "${RED}❌ Missing directory: $dir${NC}"
        ALL_CHECKS_PASSED=false
    fi
done

# Check key files
required_files=(
    "today_nft_contract/contracts/TodaysNFT.sol"
    "today_nft_contract/scripts/deploy.ts"
    "today_nft_contract/hardhat.config.ts"
    "today_nft_auction/server.js"
    "today_nft_auction/cron.js"
    "today_nft_auction/prisma/schema.prisma"
    "today_nft_ui/src/routes/+page.svelte"
    "deploy.sh"
)

for file in "${required_files[@]}"; do
    if file_exists "$file"; then
        echo -e "${GREEN}✅ File: $file${NC}"
    else
        echo -e "${RED}❌ Missing file: $file${NC}"
        ALL_CHECKS_PASSED=false
    fi
done

echo ""

# Check environment variables
echo -e "${BLUE}🔐 Environment Variables${NC}"

if [[ -n "$PRIVATE_KEY" ]]; then
    echo -e "${GREEN}✅ PRIVATE_KEY is set${NC}"
else
    echo -e "${RED}❌ PRIVATE_KEY not set (required for deployment)${NC}"
    ALL_CHECKS_PASSED=false
fi

if [[ -n "$PINATA_API_KEY" ]]; then
    echo -e "${GREEN}✅ PINATA_API_KEY is set${NC}"
else
    echo -e "${YELLOW}⚠️  PINATA_API_KEY not set (IPFS uploads will fail)${NC}"
fi

if [[ -n "$PINATA_API_SECRET_KEY" ]]; then
    echo -e "${GREEN}✅ PINATA_API_SECRET_KEY is set${NC}"
else
    echo -e "${YELLOW}⚠️  PINATA_API_SECRET_KEY not set (IPFS uploads will fail)${NC}"
fi

if [[ -n "$TREASURY_WALLET" ]]; then
    echo -e "${GREEN}✅ TREASURY_WALLET is set${NC}"
else
    echo -e "${YELLOW}⚠️  TREASURY_WALLET not set (will default to deployer)${NC}"
fi

echo ""

# Check package.json files
echo -e "${BLUE}📦 Package Dependencies${NC}"

package_dirs=(
    "today_nft_contract"
    "today_nft_auction"
    "today_nft_ui"
)

for dir in "${package_dirs[@]}"; do
    if file_exists "$dir/package.json"; then
        echo -e "${GREEN}✅ Package.json: $dir${NC}"
        
        # Check if node_modules exists
        if dir_exists "$dir/node_modules"; then
            echo -e "${GREEN}  ↳ Dependencies installed${NC}"
        else
            echo -e "${YELLOW}  ↳ Dependencies not installed (run 'npm install')${NC}"
        fi
    else
        echo -e "${RED}❌ Missing package.json: $dir${NC}"
        ALL_CHECKS_PASSED=false
    fi
done

echo ""

# Check contract compilation
echo -e "${BLUE}🔨 Smart Contract${NC}"

if dir_exists "today_nft_contract/artifacts"; then
    echo -e "${GREEN}✅ Contract artifacts exist${NC}"
else
    echo -e "${YELLOW}⚠️  Contract not compiled (run 'npx hardhat compile')${NC}"
fi

if file_exists "today_nft_contract/artifacts/contracts/TodaysNFT.sol/TodaysNFT.json"; then
    echo -e "${GREEN}✅ TodaysNFT contract artifacts${NC}"
else
    echo -e "${YELLOW}⚠️  TodaysNFT contract not compiled${NC}"
fi

echo ""

# Network connectivity test
echo -e "${BLUE}🌐 Network Connectivity${NC}"

if command_exists curl; then
    if curl -s --max-time 5 https://polygon-rpc.com > /dev/null; then
        echo -e "${GREEN}✅ Polygon RPC accessible${NC}"
    else
        echo -e "${YELLOW}⚠️  Cannot reach Polygon RPC (check internet connection)${NC}"
    fi
    
    if curl -s --max-time 5 https://api.pinata.cloud > /dev/null; then
        echo -e "${GREEN}✅ Pinata API accessible${NC}"
    else
        echo -e "${YELLOW}⚠️  Cannot reach Pinata API${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  curl not available for connectivity tests${NC}"
fi

echo ""

# Wallet validation
echo -e "${BLUE}💰 Wallet Validation${NC}"

if [[ -n "$PRIVATE_KEY" ]]; then
    # Basic private key format check (64 hex characters)
    if [[ ${#PRIVATE_KEY} -eq 64 ]] && [[ "$PRIVATE_KEY" =~ ^[0-9a-fA-F]+$ ]]; then
        echo -e "${GREEN}✅ Private key format appears valid${NC}"
    elif [[ ${#PRIVATE_KEY} -eq 66 ]] && [[ "$PRIVATE_KEY" =~ ^0x[0-9a-fA-F]+$ ]]; then
        echo -e "${GREEN}✅ Private key format appears valid (with 0x prefix)${NC}"
    else
        echo -e "${RED}❌ Private key format appears invalid${NC}"
        ALL_CHECKS_PASSED=false
    fi
else
    echo -e "${RED}❌ No private key to validate${NC}"
fi

echo ""

# Final status
echo -e "${BLUE}📊 Summary${NC}"

if [[ "$ALL_CHECKS_PASSED" == true ]]; then
    echo -e "${GREEN}🎉 All critical checks passed!${NC}"
    echo -e "${GREEN}✅ System is ready for deployment${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Set any missing optional environment variables"
    echo "2. Fund your wallet with MATIC for deployment"
    echo "3. Run ./deploy.sh to deploy the complete system"
    echo ""
    echo -e "${YELLOW}💡 Optional Improvements:${NC}"
    if [[ -z "$PINATA_API_KEY" ]] || [[ -z "$PINATA_API_SECRET_KEY" ]]; then
        echo "- Set up Pinata API keys for IPFS functionality"
    fi
    if [[ -z "$TREASURY_WALLET" ]]; then
        echo "- Set TREASURY_WALLET for custom treasury address"
    fi
    exit 0
else
    echo -e "${RED}❌ Some critical checks failed${NC}"
    echo -e "${RED}🚫 Please fix the issues above before deployment${NC}"
    echo ""
    echo -e "${BLUE}📋 Required Actions:${NC}"
    if [[ -z "$PRIVATE_KEY" ]]; then
        echo "- Set PRIVATE_KEY environment variable"
    fi
    echo "- Install missing dependencies with 'npm install'"
    echo "- Ensure all required files are present"
    echo ""
    exit 1
fi