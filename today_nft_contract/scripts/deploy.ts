import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🚀 Starting TodaysNFT deployment...");
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📍 Deploying contracts with account:", deployer.address);
    
    // Check balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "MATIC");
    
    if (balance < ethers.parseEther("0.1")) {
        console.warn("⚠️  Low balance detected! Make sure you have enough MATIC for deployment.");
    }
    
    // Treasury wallet configuration
    const treasuryWallet = process.env.TREASURY_WALLET || deployer.address;
    console.log("🏦 Treasury wallet:", treasuryWallet);
    
    // Deploy TodaysNFT contract
    console.log("📝 Deploying TodaysNFT contract...");
    const TodaysNFT = await ethers.getContractFactory("TodaysNFT");
    const todaysNFT = await TodaysNFT.deploy(treasuryWallet);
    
    await todaysNFT.waitForDeployment();
    const contractAddress = await todaysNFT.getAddress();
    
    console.log("✅ TodaysNFT deployed to:", contractAddress);
    console.log("🔗 Transaction hash:", todaysNFT.deploymentTransaction()?.hash);
    
    // Verify initial configuration
    console.log("\n🔍 Verifying initial configuration...");
    
    const owner = await todaysNFT.owner();
    console.log("👑 Contract owner:", owner);
    
    const treasury = await todaysNFT.treasuryWallet();
    console.log("🏦 Treasury wallet:", treasury);
    
    const auctionConfig = await todaysNFT.auctionConfig();
    console.log("⚙️  Auction configuration:");
    console.log("  - Start time:", auctionConfig.startTime.toString(), "seconds from midnight");
    console.log("  - Duration:", auctionConfig.duration.toString(), "seconds");
    console.log("  - Min bid increment:", ethers.formatEther(auctionConfig.minBidIncrement), "MATIC");
    console.log("  - Auto mint enabled:", auctionConfig.autoMintEnabled);
    
    // Test basic functionality
    console.log("\n🧪 Testing basic functionality...");
    
    try {
        // Test exists function
        const exists = await todaysNFT.exists("2024-01-01");
        console.log("✅ exists() function working, result for 2024-01-01:", exists);
        
        // Test getCurrentTokenId
        const currentTokenId = await todaysNFT.getCurrentTokenId();
        console.log("✅ getCurrentTokenId() working, current:", currentTokenId.toString());
        
        console.log("✅ All basic functions working correctly!");
        
    } catch (error) {
        console.error("❌ Error testing basic functionality:", error);
    }
    
    // Create environment configuration
    console.log("\n📋 Creating environment configuration...");
    
    const envConfig = `
# TodaysNFT Contract Configuration
CONTRACT_ADDRESS=${contractAddress}
TREASURY_WALLET=${treasuryWallet}
OWNER_ADDRESS=${deployer.address}
NETWORK=polygon
RPC_URL=${process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'}

# For auction server
POLYGON_RPC_URL=${process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'}
PRIVATE_KEY=${process.env.PRIVATE_KEY || 'YOUR_PRIVATE_KEY_HERE'}

# Pinata Configuration (for IPFS)
PINATA_API_KEY=${process.env.PINATA_API_KEY || 'YOUR_PINATA_API_KEY'}
PINATA_API_SECRET_KEY=${process.env.PINATA_API_SECRET_KEY || 'YOUR_PINATA_SECRET_KEY'}
`;
    
    console.log("📝 Environment configuration:");
    console.log(envConfig);
    
    // Save deployment info to JSON
    const deploymentInfo = {
        contractAddress: contractAddress,
        deployerAddress: deployer.address,
        treasuryWallet: treasuryWallet,
        deploymentTxHash: todaysNFT.deploymentTransaction()?.hash,
        networkName: "polygon",
        timestamp: new Date().toISOString(),
        auctionConfig: {
            startTime: auctionConfig.startTime.toString(),
            duration: auctionConfig.duration.toString(),
            minBidIncrement: auctionConfig.minBidIncrement.toString(),
            autoMintEnabled: auctionConfig.autoMintEnabled
        }
    };
    
    console.log("\n💾 Deployment summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // Instructions for next steps
    console.log("\n📋 Next Steps:");
    console.log("1. Copy the CONTRACT_ADDRESS to your auction server .env file");
    console.log("2. Update the ABI file in the auction server");
    console.log("3. Fund the deployer wallet with some MATIC for minting transactions");
    console.log("4. Configure Pinata API keys for IPFS metadata storage");
    console.log("5. Test the auction flow on a testnet first");
    
    console.log("\n✨ Deployment completed successfully!");
    
    return {
        contractAddress,
        deploymentInfo
    };
}

// Handle errors and run deployment
main()
    .then((result) => {
        console.log("\n🎉 Deployment finished!");
        console.log("Contract Address:", result.contractAddress);
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });