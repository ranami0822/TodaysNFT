#!/bin/bash

# Today's NFT Complete Deployment Script
# This script deploys the entire system in production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="18"
POLYGON_RPC_URL="https://polygon-rpc.com"
NETWORK="polygon"  # Change to "mumbai" for testnet

echo -e "${BLUE}🚀 Today's NFT Complete Deployment Script${NC}"
echo -e "${BLUE}===========================================${NC}"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Node.js if not present
install_nodejs() {
    if ! command_exists node; then
        echo -e "${YELLOW}📦 Installing Node.js ${NODE_VERSION}...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo -e "${GREEN}✅ Node.js already installed: $(node --version)${NC}"
    fi
}

# Function to check environment variables
check_environment() {
    echo -e "${BLUE}🔍 Checking environment variables...${NC}"
    
    if [[ -z "$PRIVATE_KEY" ]]; then
        echo -e "${RED}❌ PRIVATE_KEY environment variable is required${NC}"
        echo "Please set it with: export PRIVATE_KEY=your_private_key"
        exit 1
    fi
    
    if [[ -z "$PINATA_API_KEY" ]]; then
        echo -e "${YELLOW}⚠️  PINATA_API_KEY not set - IPFS uploads will fail${NC}"
    fi
    
    if [[ -z "$PINATA_API_SECRET_KEY" ]]; then
        echo -e "${YELLOW}⚠️  PINATA_API_SECRET_KEY not set - IPFS uploads will fail${NC}"
    fi
    
    echo -e "${GREEN}✅ Environment check completed${NC}"
}

# Function to deploy smart contract
deploy_contract() {
    echo -e "${BLUE}📝 Deploying smart contract...${NC}"
    
    cd today_nft_contract
    
    # Install dependencies
    echo -e "${YELLOW}📦 Installing contract dependencies...${NC}"
    npm install
    
    # Compile contracts
    echo -e "${YELLOW}🔨 Compiling contracts...${NC}"
    npx hardhat compile
    
    # Deploy to network
    echo -e "${YELLOW}🚀 Deploying to ${NETWORK}...${NC}"
    if [[ "$NETWORK" == "polygon" ]]; then
        DEPLOYED_ADDRESS=$(npx hardhat run scripts/deploy.ts --network polygon | grep "TodaysNFT deployed to:" | awk '{print $4}')
    else
        DEPLOYED_ADDRESS=$(npx hardhat run scripts/deploy.ts --network mumbai | grep "TodaysNFT deployed to:" | awk '{print $4}')
    fi
    
    if [[ -z "$DEPLOYED_ADDRESS" ]]; then
        echo -e "${RED}❌ Contract deployment failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Contract deployed to: ${DEPLOYED_ADDRESS}${NC}"
    export CONTRACT_ADDRESS="$DEPLOYED_ADDRESS"
    
    # Copy ABI to auction server
    mkdir -p ../today_nft_auction/artifacts/contracts/
    cp artifacts/contracts/TodaysNFT.sol/TodaysNFT.json ../today_nft_auction/artifacts/contracts/TodaysNFT.json
    
    cd ..
}

# Function to setup auction server
setup_auction_server() {
    echo -e "${BLUE}🖥️  Setting up auction server...${NC}"
    
    cd today_nft_auction
    
    # Install dependencies
    echo -e "${YELLOW}📦 Installing auction server dependencies...${NC}"
    npm install
    
    # Setup database
    echo -e "${YELLOW}🗄️  Setting up database...${NC}"
    npx prisma generate
    npx prisma db push
    
    # Create .env file
    echo -e "${YELLOW}⚙️  Creating environment configuration...${NC}"
    cat > .env << EOF
# Blockchain Configuration
POLYGON_RPC_URL=${POLYGON_RPC_URL}
RPC_URL=${POLYGON_RPC_URL}
PRIVATE_KEY=${PRIVATE_KEY}
CONTRACT_ADDRESS=${CONTRACT_ADDRESS}
NETWORK=${NETWORK}

# Pinata IPFS Configuration
PINATA_API_KEY=${PINATA_API_KEY}
PINATA_API_SECRET_KEY=${PINATA_API_SECRET_KEY}

# Server Configuration
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL="file:./dev.db"
EOF
    
    echo -e "${GREEN}✅ Auction server setup completed${NC}"
    
    cd ..
}

# Function to setup UI
setup_ui() {
    echo -e "${BLUE}🎨 Setting up UI...${NC}"
    
    cd today_nft_ui
    
    # Install dependencies
    echo -e "${YELLOW}📦 Installing UI dependencies...${NC}"
    npm install
    
    # Build for production
    echo -e "${YELLOW}🔨 Building UI for production...${NC}"
    npm run build
    
    echo -e "${GREEN}✅ UI setup completed${NC}"
    
    cd ..
}

# Function to create systemd services
create_systemd_services() {
    echo -e "${BLUE}🔧 Creating systemd services...${NC}"
    
    # Auction server service
    sudo tee /etc/systemd/system/today-nft-auction.service > /dev/null << EOF
[Unit]
Description=Today's NFT Auction Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)/today_nft_auction
Environment=NODE_ENV=production
ExecStart=$(which node) server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # UI service (using serve)
    sudo tee /etc/systemd/system/today-nft-ui.service > /dev/null << EOF
[Unit]
Description=Today's NFT UI Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)/today_nft_ui
ExecStart=$(which npx) serve -s build -l 3001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable services
    sudo systemctl enable today-nft-auction
    sudo systemctl enable today-nft-ui
    
    echo -e "${GREEN}✅ Systemd services created and enabled${NC}"
}

# Function to setup nginx
setup_nginx() {
    echo -e "${BLUE}🌐 Setting up Nginx...${NC}"
    
    # Install nginx if not present
    if ! command_exists nginx; then
        echo -e "${YELLOW}📦 Installing Nginx...${NC}"
        sudo apt update
        sudo apt install -y nginx
    fi
    
    # Create nginx configuration
    sudo tee /etc/nginx/sites-available/today-nft << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Change this to your domain
    
    # UI (Frontend)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # API (Backend)
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket for real-time updates
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/today-nft /etc/nginx/sites-enabled/
    
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    sudo nginx -t
    
    # Restart nginx
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    echo -e "${GREEN}✅ Nginx setup completed${NC}"
    echo -e "${YELLOW}ℹ️  Remember to update server_name in /etc/nginx/sites-available/today-nft with your domain${NC}"
}

# Function to setup SSL with Certbot
setup_ssl() {
    echo -e "${BLUE}🔒 Setting up SSL certificate...${NC}"
    
    # Install certbot if not present
    if ! command_exists certbot; then
        echo -e "${YELLOW}📦 Installing Certbot...${NC}"
        sudo apt install -y certbot python3-certbot-nginx
    fi
    
    echo -e "${YELLOW}ℹ️  To setup SSL, run after updating your domain:${NC}"
    echo -e "${YELLOW}sudo certbot --nginx -d your-domain.com -d www.your-domain.com${NC}"
}

# Function to setup firewall
setup_firewall() {
    echo -e "${BLUE}🔥 Setting up firewall...${NC}"
    
    if command_exists ufw; then
        sudo ufw --force enable
        sudo ufw allow ssh
        sudo ufw allow 'Nginx Full'
        echo -e "${GREEN}✅ Firewall configured${NC}"
    else
        echo -e "${YELLOW}⚠️  UFW not installed, skipping firewall setup${NC}"
    fi
}

# Function to start services
start_services() {
    echo -e "${BLUE}🏃 Starting services...${NC}"
    
    # Start auction server
    sudo systemctl start today-nft-auction
    sudo systemctl status today-nft-auction --no-pager
    
    # Start UI server
    sudo systemctl start today-nft-ui
    sudo systemctl status today-nft-ui --no-pager
    
    echo -e "${GREEN}✅ All services started${NC}"
}

# Function to display deployment summary
display_summary() {
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${BLUE}===========================================${NC}"
    echo -e "${GREEN}📍 Contract Address: ${CONTRACT_ADDRESS}${NC}"
    echo -e "${GREEN}🌐 Frontend: http://localhost:3001${NC}"
    echo -e "${GREEN}🔌 API: http://localhost:3000${NC}"
    echo -e "${BLUE}===========================================${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Update your domain in /etc/nginx/sites-available/today-nft"
    echo "2. Setup SSL with: sudo certbot --nginx -d your-domain.com"
    echo "3. Fund the deployer wallet with MATIC for minting"
    echo "4. Test the auction flow"
    echo "5. Monitor logs with: sudo journalctl -u today-nft-auction -f"
    echo ""
    echo -e "${YELLOW}🔧 Service Management:${NC}"
    echo "- Restart auction server: sudo systemctl restart today-nft-auction"
    echo "- Restart UI: sudo systemctl restart today-nft-ui"
    echo "- Check logs: sudo journalctl -u today-nft-auction -f"
    echo "- Stop services: sudo systemctl stop today-nft-auction today-nft-ui"
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting deployment process...${NC}"
    
    # Prerequisites
    install_nodejs
    check_environment
    
    # Core deployment
    deploy_contract
    setup_auction_server
    setup_ui
    
    # System services
    create_systemd_services
    setup_nginx
    setup_ssl
    setup_firewall
    
    # Start everything
    start_services
    
    # Show summary
    display_summary
}

# Check if this script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi