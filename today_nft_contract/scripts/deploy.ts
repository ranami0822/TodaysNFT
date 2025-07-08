const hre = require("hardhat");

async function main() {
  const TodaysNFT = await hre.ethers.getContractFactory("TodaysNFT");
  const contract = await TodaysNFT.deploy();
  
  await contract.waitForDeployment();
  console.log("TodaysNFT deployed to:", contract.target);
  
}

main().catch((error)=>{
  console.error("🥹😢エラー:",error);
  process.exitCode = 1;
});