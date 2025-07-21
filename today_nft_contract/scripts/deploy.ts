import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🚀 Today's NFT デプロイ開始...");
    
    // デプロイヤーアカウント取得
    const [deployer] = await ethers.getSigners();
    console.log("📍 コントラクトデプロイ実行者:", deployer.address);
    
    // 残高確認
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 アカウント残高:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.01")) {
        console.warn("⚠️  残高が少ないです！デプロイに十分なETHがあることを確認してください。");
    }
    
    // Treasury ウォレット設定
    const treasuryWallet = process.env.TREASURY_WALLET || deployer.address;
    console.log("🏦 Treasury ウォレット:", treasuryWallet);
    
    // TodaysNFT コントラクトデプロイ
    console.log("📝 TodaysNFT コントラクトをデプロイ中...");
    const TodaysNFT = await ethers.getContractFactory("TodaysNFT");
    const todaysNFT = await TodaysNFT.deploy(treasuryWallet);
    
    await todaysNFT.waitForDeployment();
    const contractAddress = await todaysNFT.getAddress();
    
    console.log("✅ TodaysNFT デプロイ完了:", contractAddress);
    console.log("🔗 トランザクションハッシュ:", todaysNFT.deploymentTransaction()?.hash);
    
    // 初期設定確認
    console.log("\n🔍 初期設定確認中...");
    
    const owner = await todaysNFT.owner();
    console.log("👑 コントラクト所有者:", owner);
    
    const treasury = await todaysNFT.treasuryWallet();
    console.log("🏦 Treasury ウォレット:", treasury);
    
    const auctionConfig = await todaysNFT.auctionConfig();
    console.log("⚙️  オークション設定:");
    console.log("  - 開始時間:", auctionConfig.startTime.toString(), "秒（午前0時から）");
    console.log("  - 期間:", auctionConfig.duration.toString(), "秒");
    console.log("  - 最小入札増分:", ethers.formatEther(auctionConfig.minBidIncrement), "ETH");
    console.log("  - 自動ミント有効:", auctionConfig.autoMintEnabled);
    
    // 基本機能テスト
    console.log("\n🧪 基本機能テスト中...");
    
    try {
        // exists関数テスト
        const exists = await todaysNFT.exists("2024-01-01");
        console.log("✅ exists() 関数動作確認、2024-01-01の結果:", exists);
        
        // getCurrentTokenId テスト
        const currentTokenId = await todaysNFT.getCurrentTokenId();
        console.log("✅ getCurrentTokenId() 関数動作確認、現在:", currentTokenId.toString());
        
        console.log("✅ 全ての基本機能が正常に動作しています！");
        
    } catch (error) {
        console.error("❌ 基本機能テストエラー:", error);
    }
    
    // 環境設定作成
    console.log("\n📋 環境設定ファイル作成中...");
    
    const networkName = process.env.HARDHAT_NETWORK || "sepolia";
    let rpcUrl = "https://sepolia.infura.io/v3/YOUR_INFURA_KEY";
    
    if (networkName === "mainnet") {
        rpcUrl = "https://mainnet.infura.io/v3/YOUR_INFURA_KEY";
    }
    
    const envConfig = `
# Today's NFT コントラクト設定
CONTRACT_ADDRESS=${contractAddress}
TREASURY_WALLET=${treasuryWallet}
OWNER_ADDRESS=${deployer.address}
NETWORK=${networkName}
RPC_URL=${rpcUrl}

# オークションサーバー用
SEPOLIA_RPC_URL=${process.env.SEPOLIA_RPC_URL || rpcUrl}
MAINNET_RPC_URL=${process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY'}
PRIVATE_KEY=${process.env.PRIVATE_KEY || 'YOUR_PRIVATE_KEY_HERE'}

# Pinata設定（IPFS用）
PINATA_API_KEY=${process.env.PINATA_API_KEY || 'YOUR_PINATA_API_KEY'}
PINATA_API_SECRET_KEY=${process.env.PINATA_API_SECRET_KEY || 'YOUR_PINATA_SECRET_KEY'}

# Etherscan API（コントラクト検証用）
ETHERSCAN_API_KEY=${process.env.ETHERSCAN_API_KEY || 'YOUR_ETHERSCAN_API_KEY'}
`;
    
    console.log("📝 環境設定:");
    console.log(envConfig);
    
    // デプロイ情報をJSONで保存
    const deploymentInfo = {
        contractAddress: contractAddress,
        deployerAddress: deployer.address,
        treasuryWallet: treasuryWallet,
        deploymentTxHash: todaysNFT.deploymentTransaction()?.hash,
        networkName: networkName,
        timestamp: new Date().toISOString(),
        auctionConfig: {
            startTime: auctionConfig.startTime.toString(),
            duration: auctionConfig.duration.toString(),
            minBidIncrement: auctionConfig.minBidIncrement.toString(),
            autoMintEnabled: auctionConfig.autoMintEnabled
        }
    };
    
    console.log("\n💾 デプロイサマリー:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // 次のステップ案内
    console.log("\n📋 次のステップ:");
    console.log("1. CONTRACT_ADDRESS をオークションサーバーの .env ファイルにコピー");
    console.log("2. オークションサーバーでABIファイルを更新");
    console.log("3. デプロイヤーウォレットにミント用のETHを送金");
    console.log("4. Pinata API キーを設定してIPFSメタデータストレージを有効化");
    console.log("5. まずテストネットでオークションフローをテスト");
    
    console.log("\n✨ デプロイが正常に完了しました！");
    
    return {
        contractAddress,
        deploymentInfo
    };
}

// エラーハンドリングとデプロイ実行
main()
    .then((result) => {
        console.log("\n🎉 デプロイ完了！");
        console.log("コントラクトアドレス:", result.contractAddress);
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ デプロイ失敗:", error);
        process.exit(1);
    });