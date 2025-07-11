import { ethers, ContractFactory } from "ethers";
import * as TodaysNFTArtifact from "../artifacts/contracts/TodaysNFT.sol/TodaysNFT.json";

async function main() {
  console.log("🚀 Deploying TodaysNFT contract...");

  // POL token address on Polygon mainnet
  const POL_TOKEN_ADDRESS = "0xEa2F74a2F4A9C2b09AF03cAC23904D7e881EeCf6";//amoy:0x2Ef1C802355c500A3493F2Db8cB9C24AF12c42B0

  // Set up provider and signer (update as needed)
  const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);

  const TodaysNFT = new ContractFactory(
    TodaysNFTArtifact.abi,
    TodaysNFTArtifact.bytecode,
    wallet
  );
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