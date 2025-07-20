# 🗓️ Today's NFT - Complete Daily NFT Auction System

> A complete blockchain-based daily NFT auction system where users compete to own each day as an NFT

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Polygon](https://img.shields.io/badge/Blockchain-Polygon-purple.svg)](https://polygon.technology/)

## 🌟 Features

### 🏆 Core Auction System
- **Daily Auctions**: Automatic daily auctions for each calendar date
- **Real-time Bidding**: Live WebSocket-based bidding with instant updates
- **Wallet Integration**: MetaMask and WalletConnect support
- **Signature Verification**: Cryptographic proof for all bids
- **Winner Selection**: Automatic winner determination and NFT preparation

### 📅 Calendar Functionality
- **Interactive Calendar**: Visual month-by-month calendar view
- **Historical Data**: View past auctions and winners
- **Date Navigation**: Easy browsing through different months/years
- **Winner Indicators**: Clear visual indicators for auction winners

### 🎨 NFT Management
- **Automatic Minting**: Daily NFT creation for auction winners
- **IPFS Storage**: Decentralized metadata storage via Pinata
- **Rich Metadata**: Comprehensive NFT attributes and properties
- **Collection View**: User portfolio management
- **Marketplace Ready**: Built-in marketplace functionality

### 🔧 Advanced Features
- **Cron Jobs**: Automated daily processes
- **Error Recovery**: Robust retry mechanisms for failed operations
- **Statistics Dashboard**: Comprehensive analytics and insights
- **Multi-Network**: Polygon mainnet and Mumbai testnet support
- **Production Ready**: Full deployment automation

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Smart Contract│    │  Auction Server │    │   Frontend UI   │
│   (Polygon)     │◄──►│   (Node.js)     │◄──►│   (Svelte)      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  IPFS (Pinata)  │    │ SQLite Database │    │  WebSocket      │
│   Metadata      │    │   Auction Data  │    │ Real-time Bids  │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 📁 Project Structure

```
today-nft-system/
├── 📁 today_nft_contract/     # Smart contracts (Hardhat)
│   ├── contracts/
│   │   └── TodaysNFT.sol      # Main NFT contract
│   ├── scripts/
│   │   └── deploy.ts          # Deployment script
│   └── hardhat.config.ts      # Hardhat configuration
│
├── 📁 today_nft_auction/      # Backend server (Node.js + Express)
│   ├── server.js              # Main server file
│   ├── cron.js                # Automated daily tasks
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   └── package.json
│
├── 📁 today_nft_ui/           # Frontend (SvelteKit)
│   ├── src/
│   │   ├── routes/
│   │   │   └── +page.svelte   # Main UI
│   │   └── lib/               # Utility libraries
│   └── package.json
│
├── 📄 deploy.sh               # Complete deployment script
└── 📄 README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- A Polygon wallet with some MATIC
- Pinata account for IPFS (recommended)

### 1. Environment Setup

```bash
# Set required environment variables
export PRIVATE_KEY="your_wallet_private_key"
export PINATA_API_KEY="your_pinata_api_key"           # Optional but recommended
export PINATA_API_SECRET_KEY="your_pinata_secret_key" # Optional but recommended
export TREASURY_WALLET="your_treasury_wallet_address" # Optional (defaults to deployer)
```

### 2. One-Click Deployment

```bash
# Make deployment script executable
chmod +x deploy.sh

# Deploy entire system
./deploy.sh
```

This will:
- ✅ Install all dependencies
- ✅ Deploy smart contract to Polygon
- ✅ Setup auction server with database
- ✅ Build and configure UI
- ✅ Create systemd services
- ✅ Configure Nginx reverse proxy
- ✅ Setup SSL certificates (Certbot)
- ✅ Configure firewall

### 3. Manual Installation (Alternative)

<details>
<summary>Click to expand manual installation steps</summary>

#### Smart Contract Deployment

```bash
cd today_nft_contract
npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network polygon
```

#### Auction Server Setup

```bash
cd today_nft_auction
npm install

# Create .env file
cat > .env << EOF
POLYGON_RPC_URL=https://polygon-rpc.com
PRIVATE_KEY=your_private_key
CONTRACT_ADDRESS=deployed_contract_address
PINATA_API_KEY=your_pinata_key
PINATA_API_SECRET_KEY=your_pinata_secret
EOF

# Setup database
npx prisma generate
npx prisma db push

# Start server
npm start
```

#### UI Setup

```bash
cd today_nft_ui
npm install
npm run build

# Serve static files
npx serve -s build
```

</details>

## 🎯 How It Works

### Daily Auction Flow

1. **🌅 New Day Begins**: Each day at midnight (JST), a new auction automatically starts
2. **💰 Bidding Opens**: Users can place bids throughout the day
3. **📈 Real-time Updates**: All users see live bid updates via WebSocket
4. **🏆 Winner Selection**: At day end, highest bidder wins
5. **🎨 NFT Creation**: System automatically generates metadata and uploads to IPFS
6. **⛓️ Blockchain Mint**: NFT is minted to winner's wallet
7. **📊 Statistics Update**: All data is recorded for analytics

### Smart Contract Features

- **ERC-721 Standard**: Full NFT compatibility
- **Access Control**: Owner and pending winner management
- **Payment Handling**: Automatic treasury distribution
- **Calendar Integration**: Built-in date tracking and validation
- **Marketplace Ready**: Transfer functions with platform fees
- **Emergency Functions**: Admin controls for edge cases

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/winner/:date?` | GET | Get auction winner for date |
| `/api/history/:date?` | GET | Get bidding history |
| `/api/calendar/:year/:month` | GET | Get monthly calendar data |
| `/api/collection/:wallet` | GET | Get user's NFT collection |
| `/api/bid` | POST | Submit a bid |
| `/api/execute-mint` | POST | Trigger NFT minting |
| `/api/stats` | GET | Get system statistics |

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Wallet private key for minting | ✅ Yes |
| `CONTRACT_ADDRESS` | Deployed contract address | ✅ Yes |
| `POLYGON_RPC_URL` | Polygon RPC endpoint | ✅ Yes |
| `PINATA_API_KEY` | Pinata API key for IPFS | 🟡 Recommended |
| `PINATA_API_SECRET_KEY` | Pinata secret key | 🟡 Recommended |
| `TREASURY_WALLET` | Treasury wallet address | ❌ Optional |
| `PORT` | Server port (default: 3000) | ❌ Optional |

### Auction Configuration

The system supports configurable auction parameters:

```javascript
// Example auction config
{
  startTime: 0,           // Midnight (seconds from start of day)
  duration: 86400,        // 24 hours in seconds
  minBidIncrement: 0.001, // Minimum bid increment in MATIC
  autoMintEnabled: true,  // Whether to auto-mint NFTs
  timezone: "Asia/Tokyo"  // Auction timezone
}
```

## 📊 Database Schema

The system uses SQLite with Prisma ORM. Key tables:

- **AuctionBid**: All bid data with signatures
- **PendingMint**: NFTs waiting to be minted
- **NFT**: Minted NFT records
- **User**: User profiles and statistics
- **SystemEvent**: System logs and events
- **DailyStats**: Daily analytics data

## 🔒 Security Features

- **Cryptographic Signatures**: All bids require wallet signature verification
- **Input Validation**: Comprehensive validation on all user inputs
- **Rate Limiting**: Protection against spam and abuse
- **SQL Injection Protection**: Parameterized queries via Prisma
- **XSS Protection**: Input sanitization and validation
- **CORS Configuration**: Proper cross-origin request handling

## 🌐 Deployment Options

### Production Deployment

The included `deploy.sh` script provides a complete production setup:

- **Load Balancing**: Nginx reverse proxy configuration
- **SSL Certificates**: Automatic HTTPS via Certbot
- **Process Management**: Systemd services with auto-restart
- **Monitoring**: Built-in health checks and logging
- **Firewall**: UFW configuration for security

### Development Setup

```bash
# Start all services in development mode
cd today_nft_auction && npm run dev &
cd today_nft_ui && npm run dev &
```

### Docker Support

<details>
<summary>Docker configuration (coming soon)</summary>

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

</details>

## 📈 Monitoring & Analytics

### Built-in Statistics

- Total bids and unique bidders
- Daily/monthly volume tracking
- User engagement metrics
- NFT mint success rates
- System health monitoring

### Log Management

```bash
# View auction server logs
sudo journalctl -u today-nft-auction -f

# View UI server logs
sudo journalctl -u today-nft-ui -f

# View nginx logs
sudo tail -f /var/log/nginx/access.log
```

## 🔧 Maintenance

### Daily Operations

The system is designed to run autonomously with minimal maintenance:

- **Automated Auctions**: Daily cron jobs handle all auction logic
- **Self-Healing**: Retry mechanisms for failed operations
- **Health Checks**: Automatic system monitoring
- **Error Notifications**: Built-in alerting system

### Manual Operations

```bash
# Restart services
sudo systemctl restart today-nft-auction today-nft-ui

# Check system status
sudo systemctl status today-nft-auction today-nft-ui nginx

# View system health
curl http://localhost:3000/health

# Manual mint trigger (if needed)
curl -X POST http://localhost:3000/api/execute-mint \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-01"}'
```

## 🚨 Troubleshooting

### Common Issues

<details>
<summary>Contract deployment fails</summary>

- Check that you have sufficient MATIC in your wallet
- Verify `PRIVATE_KEY` is correctly set
- Ensure RPC URL is accessible
- Try using a different RPC endpoint

</details>

<details>
<summary>IPFS uploads fail</summary>

- Verify Pinata API credentials
- Check internet connectivity
- Try regenerating Pinata API keys
- Consider using alternative IPFS providers

</details>

<details>
<summary>Bids not appearing</summary>

- Check WebSocket connection in browser console
- Verify signature verification is working
- Check auction server logs
- Ensure wallet is properly connected

</details>

<details>
<summary>NFT minting fails</summary>

- Check deployer wallet has sufficient MATIC
- Verify contract address is correct
- Check for pending transactions
- Review error logs for specific issues

</details>

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/today-nft-system
cd today-nft-system

# Install dependencies for all components
cd today_nft_contract && npm install && cd ..
cd today_nft_auction && npm install && cd ..
cd today_nft_ui && npm install && cd ..

# Start development environment
npm run dev:all
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenZeppelin](https://openzeppelin.com/) for secure smart contract libraries
- [Polygon](https://polygon.technology/) for scalable blockchain infrastructure
- [Pinata](https://pinata.cloud/) for reliable IPFS services
- [Prisma](https://prisma.io/) for excellent database tooling
- [SvelteKit](https://kit.svelte.dev/) for modern web development

## 📞 Support

- **Documentation**: [Wiki](https://github.com/your-org/today-nft-system/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/today-nft-system/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/today-nft-system/discussions)
- **Discord**: [Join our community](https://discord.gg/your-invite)

---

<div align="center">

**Made with ❤️ for the Web3 community**

[🌐 Website](https://your-domain.com) • [🐦 Twitter](https://twitter.com/your-handle) • [📧 Email](mailto:your-email@domain.com)

</div>