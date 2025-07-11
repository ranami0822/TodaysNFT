import { ethers } from "ethers";

async function main() {
  console.log("🚀 Deploying TodaysNFT contract...");
  
  const TodaysNFT = await ethers.getContractFactory("TodaysNFT");
  console.log("📋 Deploying contract...");
  
  const todaysNFT = await TodaysNFT.deploy();
  await todaysNFT.waitForDeployment();
  
  const contractAddress = await todaysNFT.getAddress();

  console.log("✅ TodaysNFT deployed to:", contractAddress);
  console.log("💰 Payment method: Native MATIC");

  console.log("\n🔧 Configuration for your .env file:");
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);
  
  console.log("\n📝 Next steps:");
  console.log("1. Update your .env file with the CONTRACT_ADDRESS");
  console.log("2. Update the frontend CONTRACT_ADDRESS");
  console.log("3. Test the MATIC payment functionality");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });