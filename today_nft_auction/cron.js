import cron from 'node-cron';
import dayjs from 'dayjs';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';

dotenv.config();

const prisma = new PrismaClient();
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET_KEY = process.env.PINATA_API_SECRET_KEY;
const NETWORK = process.env.NETWORK || 'sepolia';

// 拡張されたコントラクトABI
let ABI;
try {
    if (existsSync('./artifacts/contracts/TodaysNFT.json')) {
        ABI = JSON.parse(readFileSync('./artifacts/contracts/TodaysNFT.json', 'utf8')).abi;
    } else {
        // フォールバック用ABI
        ABI = [
            "function setPendingWinner(address winner) external",
            "function mintToWinner(string memory date, address winner, string memory metadataUri) external payable",
            "function exists(string memory date) external view returns (bool)",
            "function getAuctionInfo(string memory date) external view returns (tuple(uint256 tokenId, address winner, uint256 price, bool minted, string metadataUri, uint256 mintTimestamp, uint256 auctionEndTime))",
            "function pendingWinners(address) external view returns (bool)"
        ];
    }
} catch (error) {
    console.error("ABI読み込みエラー:", error);
    process.exit(1);
}

let provider, wallet, contract;

// ブロックチェーン接続初期化
function initializeBlockchain() {
    const rpcUrl = NETWORK === 'mainnet' 
        ? process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY'
        : process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY';

    if (!rpcUrl || !process.env.PRIVATE_KEY || !CONTRACT_ADDRESS) {
        console.warn("⚠️  ブロックチェーン設定が不完全です");
        return false;
    }

    try {
        provider = new ethers.JsonRpcProvider(rpcUrl);
        wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
        console.log("✅ ブロックチェーン接続初期化完了");
        console.log("📍 コントラクト:", CONTRACT_ADDRESS);
        console.log("🔑 ウォレット:", wallet.address);
        console.log("🌐 ネットワーク:", NETWORK);
        return true;
    } catch (error) {
        console.error("❌ ブロックチェーン接続失敗:", error);
        return false;
    }
}

/**
 * IPFSにメタデータをアップロード（Pinata経由）
 */
async function uploadToIPFS(metadata, fileName) {
    if (!PINATA_API_KEY || !PINATA_API_SECRET_KEY) {
        throw new Error("Pinata API設定が不足しています");
    }

    try {
        const response = await axios.post(
            "https://api.pinata.cloud/pinning/pinJSONToIPFS",
            {
                pinataContent: metadata,
                pinataMetadata: { name: fileName },
                pinataOptions: { cidVersion: 1 }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    pinata_api_key: PINATA_API_KEY,
                    pinata_secret_api_key: PINATA_API_SECRET_KEY
                }
            }
        );

        return `ipfs://${response.data.IpfsHash}`;
    } catch (error) {
        console.error("IPFS アップロードエラー:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * 拡張されたNFTメタデータ生成
 */
function generateNFTMetadata(date, winner) {
    const dayOfWeek = dayjs(date).format('dddd');
    const monthName = dayjs(date).format('MMMM');
    
    return {
        name: `Today's NFT - ${date}`,
        description: `${date} (${dayOfWeek})のNFTです。勝者: ${winner.wallet}、入札額: ${winner.price} ETH。${winner.message ? `メッセージ: "${winner.message}"` : ''}`,
        image: `ipfs://QmYourImageHash/${date}.png`, // 画像生成機能を実装可能
        external_url: `https://yourapp.com/nft/${date}`,
        attributes: [
            { trait_type: "日付", value: date },
            { trait_type: "曜日", value: dayOfWeek },
            { trait_type: "月", value: monthName },
            { trait_type: "年", value: dayjs(date).year().toString() },
            { trait_type: "勝者", value: winner.wallet },
            { trait_type: "価格 (ETH)", value: winner.price.toString() },
            { trait_type: "入札時刻", value: winner.createdAt.toISOString() },
            { trait_type: "メッセージ有無", value: winner.message ? "あり" : "なし" },
            { trait_type: "メッセージ長", value: winner.message ? winner.message.length.toString() : "0" }
        ],
        properties: {
            date: date,
            winner: winner.wallet,
            price: winner.price,
            currency: "ETH",
            message: winner.message || null,
            generation_time: new Date().toISOString(),
            network: NETWORK
        }
    };
}

/**
 * 前日のToday's NFT作成
 */
async function createTodayNFT() {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    
    try {
        console.log(`🎯 [${yesterday}] 日次NFT処理開始`);

        // 既に処理済みかどうか確認
        const existingPending = await prisma.pendingMint.findUnique({
            where: { date: yesterday }
        });

        if (existingPending) {
            console.log(`⚠️  [${yesterday}] 既に処理済みです`);
            return;
        }

        // 勝者を検索（最高入札者）
        const winner = await prisma.auctionBid.findFirst({
            where: {
                date: yesterday
            },
            orderBy: {
                price: 'desc'
            }
        });

        if (!winner) {
            console.log(`❌ [${yesterday}] 入札者がいません`);
            
            // 勝者なしの日のデフォルトNFT作成
            const defaultMetadata = {
                name: `Today's NFT - ${yesterday} (勝者なし)`,
                description: `${yesterday}は入札がありませんでした。このNFTは未獲得の日を表しています。`,
                attributes: [
                    { trait_type: "日付", value: yesterday },
                    { trait_type: "状態", value: "勝者なし" },
                    { trait_type: "入札数", value: "0" }
                ]
            };

            const metadataUrl = await uploadToIPFS(defaultMetadata, `today-nft-${yesterday}-no-winner.json`);
            
            await prisma.pendingMint.create({
                data: {
                    date: yesterday,
                    wallet: "0x0000000000000000000000000000000000000000", // ヌルアドレス
                    price: 0,
                    metadataUrl,
                    minted: false
                }
            });

            console.log(`📝 [${yesterday}] 勝者なしNFTメタデータ作成完了`);
            return;
        }

        console.log(`🏆 [${yesterday}] 勝者: ${winner.wallet} (${winner.price} ETH)`);

        // メタデータ生成とアップロード
        const metadata = generateNFTMetadata(yesterday, winner);
        const metadataUrl = await uploadToIPFS(metadata, `today-nft-${yesterday}.json`);

        console.log(`📤 [${yesterday}] IPFS アップロード完了: ${metadataUrl}`);

        // コントラクトでペンディング勝者設定（利用可能な場合）
        if (contract) {
            try {
                const tx = await contract.setPendingWinner(winner.wallet);
                await tx.wait();
                console.log(`✅ [${yesterday}] コントラクトペンディング勝者設定完了: ${tx.hash}`);
            } catch (contractError) {
                console.error(`❌ [${yesterday}] コントラクト設定エラー:`, contractError);
                // プロセス全体を失敗させずに続行
            }
        }

        // ペンディングミントレコード作成
        await prisma.pendingMint.create({
            data: {
                date: yesterday,
                wallet: winner.wallet,
                price: winner.price,
                metadataUrl,
                minted: false
            }
        });

        console.log(`💾 [${yesterday}] PendingMint レコード作成完了`);

        // 自動ミント試行（有効な場合）
        await attemptAutoMint(yesterday);

    } catch (error) {
        console.error(`❌ [${yesterday}] 日次NFT作成エラー:`, error);
        
        // エラー通知送信（メール/Discord/Slackなどの通知を実装可能）
        await notifyError(`${yesterday}の日次NFT作成が失敗しました`, error);
    }
}

/**
 * 自動ミント試行
 */
async function attemptAutoMint(date) {
    if (!contract) {
        console.log(`⚠️  [${date}] コントラクト未接続のため自動ミントをスキップ`);
        return;
    }

    try {
        console.log(`🔄 [${date}] 自動ミント開始`);

        const pendingMint = await prisma.pendingMint.findUnique({
            where: { date }
        });

        if (!pendingMint || pendingMint.minted) {
            console.log(`⚠️  [${date}] PendingMintが見つからないか既にミント済み`);
            return;
        }

        // ブロックチェーン上で既に存在するかどうか確認
        const exists = await contract.exists(date);
        if (exists) {
            console.log(`⚠️  [${date}] ブロックチェーン上に既に存在`);
            
            // データベースをミント済みとして更新
            await prisma.pendingMint.update({
                where: { date },
                data: { minted: true }
            });
            return;
        }

        // 勝者なしNFTの自動ミントはスキップ
        if (pendingMint.wallet === "0x0000000000000000000000000000000000000000") {
            console.log(`⚠️  [${date}] 勝者なしNFTのため自動ミントをスキップ`);
            return;
        }

        // ウォレット残高確認
        const balance = await provider.getBalance(wallet.address);
        const requiredAmount = ethers.parseEther(pendingMint.price.toString());
        
        if (balance < requiredAmount) {
            console.warn(`⚠️  [${date}] ウォレット残高不足: ${ethers.formatEther(balance)} < ${pendingMint.price}`);
            return;
        }

        // ミント実行
        const tx = await contract.mintToWinner(
            date,
            pendingMint.wallet,
            pendingMint.metadataUrl,
            { value: requiredAmount }
        );

        console.log(`⏳ [${date}] ミントトランザクション送信: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`✅ [${date}] NFTミント完了! ブロック: ${receipt.blockNumber}`);

        // データベース更新
        await Promise.all([
            prisma.pendingMint.update({
                where: { date },
                data: { 
                    minted: true,
                    txHash: tx.hash,
                    mintedAt: new Date()
                }
            }),
            prisma.nft.upsert({
                where: { date },
                update: { txHash: tx.hash },
                create: {
                    date,
                    winner: pendingMint.wallet,
                    price: pendingMint.price,
                    metadataUrl: pendingMint.metadataUrl,
                    txHash: tx.hash
                }
            })
        ]);

        console.log(`💾 [${date}] データベース更新完了`);

        // 成功通知送信
        await notifySuccess(`${date}のNFTミントが成功しました`, {
            date,
            winner: pendingMint.wallet,
            price: pendingMint.price,
            txHash: tx.hash
        });

    } catch (error) {
        console.error(`❌ [${date}] 自動ミント失敗:`, error);
        
        // プロセス全体を失敗させず、ログ記録と通知のみ
        await notifyError(`${date}の自動ミントが失敗しました`, error);
    }
}

/**
 * 失敗した自動ミントの再試行
 */
async function retryFailedMints() {
    console.log("🔄 失敗ミント再試行開始");

    const failedMints = await prisma.pendingMint.findMany({
        where: {
            minted: false,
            wallet: { not: "0x0000000000000000000000000000000000000000" }, // 勝者なしNFTを除外
            createdAt: {
                lt: dayjs().subtract(1, 'hour').toDate() // 1時間後にのみ再試行
            }
        },
        orderBy: { createdAt: 'asc' },
        take: 5 // 1回の実行で5件まで再試行
    });

    for (const pendingMint of failedMints) {
        console.log(`🔄 [${pendingMint.date}] ミント再試行`);
        await attemptAutoMint(pendingMint.date);
        
        // レート制限を避けるため、試行間に30秒待機
        await new Promise(resolve => setTimeout(resolve, 30000));
    }

    console.log("✅ 失敗ミント再試行完了");
}

/**
 * 古いデータクリーンアップ（オプション）
 */
async function cleanupOldData() {
    const cutoffDate = dayjs().subtract(90, 'days').toDate(); // 90日保持
    
    try {
        const deleted = await prisma.auctionBid.deleteMany({
            where: {
                createdAt: { lt: cutoffDate }
            }
        });
        
        console.log(`🧹 古いデータクリーンアップ: ${deleted.count}件削除`);
    } catch (error) {
        console.error("❌ データクリーンアップエラー:", error);
    }
}

/**
 * エラー通知システム
 */
async function notifyError(message, error) {
    console.error(`📧 エラー通知: ${message}`, error);
    
    // ここで実装可能:
    // - メール通知
    // - Discord Webhook
    // - Slack Webhook
    // - データベースログ記録
    
    try {
        // 例: データベースにログ記録
        // await prisma.errorLog.create({
        //     data: {
        //         message,
        //         error: error.toString(),
        //         timestamp: new Date()
        //     }
        // });
    } catch (logError) {
        console.error("エラーログ記録失敗:", logError);
    }
}

/**
 * 成功通知システム
 */
async function notifySuccess(message, data) {
    console.log(`📧 成功通知: ${message}`, data);
    
    // ここで成功通知を実装可能
    // - 成功ミント用Discord Webhook
    // - 日次勝者発表用Twitterボット
    // - 勝者へのメール通知
}

/**
 * ヘルスチェックとステータスレポート
 */
async function healthCheck() {
    const report = {
        timestamp: new Date().toISOString(),
        blockchain: {
            connected: !!contract,
            contractAddress: CONTRACT_ADDRESS,
            walletAddress: wallet?.address,
            network: NETWORK
        },
        ipfs: {
            configured: !!(PINATA_API_KEY && PINATA_API_SECRET_KEY)
        },
        database: {
            connected: true // ここに到達すればDB接続済み
        }
    };

    console.log("🔍 ヘルスチェック:", JSON.stringify(report, null, 2));
    return report;
}

// 起動時のブロックチェーン接続初期化
const blockchainReady = initializeBlockchain();

// =====================================================================
// CRONジョブスケジュール
// =====================================================================

// 毎日午前0時1分に日次NFT作成
cron.schedule('1 0 * * *', async () => {
    console.log("⏰ 日次NFT作成ジョブ開始");
    await createTodayNFT();
}, {
    timezone: "Asia/Tokyo"
});

// 2時間ごとに失敗ミント再試行
cron.schedule('0 */2 * * *', async () => {
    console.log("⏰ 失敗ミント再試行ジョブ開始");
    await retryFailedMints();
});

// 毎時間ヘルスチェック
cron.schedule('0 * * * *', async () => {
    await healthCheck();
});

// 毎週日曜日午前2時にクリーンアップ
cron.schedule('0 2 * * 0', async () => {
    console.log("⏰ 週次クリーンアップジョブ開始");
    await cleanupOldData();
}, {
    timezone: "Asia/Tokyo"
});

// =====================================================================
// 起動チェック
// =====================================================================

console.log("🚀 Cronシステム初期化完了");
console.log("📅 日次NFT作成: 毎日 00:01 (JST)");
console.log("🔄 失敗ミント再試行: 2時間ごと");
console.log("🔍 ヘルスチェック: 1時間ごと");
console.log("🧹 データクリーンアップ: 毎週日曜 02:00 (JST)");

if (!blockchainReady) {
    console.warn("⚠️  ブロックチェーン接続なしで開始 - メタデータ作成のみ可能");
}

// 初期ヘルスチェック
setTimeout(healthCheck, 5000);

// 手動テスト用の関数エクスポート
export {
    createTodayNFT,
    attemptAutoMint,
    retryFailedMints,
    healthCheck,
    cleanupOldData
};




