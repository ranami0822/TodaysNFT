import { ethers } from "ethers";

async function main() {
  console.log("🚀 Deploying TodaysNFT contract...");

  // POL token address on Polygon mainnet
  const POL_TOKEN_ADDRESS = "0x455e53BAaC5d24EeD4b1424D9B1a26fF6B8Eef9C";
  
  const TodaysNFT = await ethers.getContractFactory("TodaysNFT");
  console.log("� Deploying contract...");
  
  const todaysNFT = await TodaysNFT.deploy(POL_TOKEN_ADDRESS);
  await todaysNFT.waitForDeployment();
  
  const contractAddress = await todaysNFT.getAddress();

  console.log("✅ TodaysNFT deployed to:", contractAddress);
  console.log("🪙 POL Token Address:", POL_TOKEN_ADDRESS);

  console.log("\n🔧 Configuration for your .env file:");
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`POL_TOKEN_ADDRESS=${POL_TOKEN_ADDRESS}`);
  
  console.log("\n📝 Next steps:");
  console.log("1. Update your .env file with the CONTRACT_ADDRESS");
  console.log("2. Update the frontend NFT_CONTRACT_ADDRESS in approvePOL function");
  console.log("3. Test the functionality");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });