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

// Enhanced ABI for the contract
let ABI;
try {
    if (existsSync('./artifacts/contracts/TodaysNFT.json')) {
        ABI = JSON.parse(readFileSync('./artifacts/contracts/TodaysNFT.json', 'utf8')).abi;
    } else {
        // Fallback ABI
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

// Initialize blockchain connection
function initializeBlockchain() {
    if (!process.env.RPC_URL || !process.env.PRIVATE_KEY || !CONTRACT_ADDRESS) {
        console.warn("⚠️  ブロックチェーン設定が不完全です");
        return false;
    }

    try {
        provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
        console.log("✅ ブロックチェーン接続初期化完了");
        console.log("📍 Contract:", CONTRACT_ADDRESS);
        console.log("🔑 Wallet:", wallet.address);
        return true;
    } catch (error) {
        console.error("❌ ブロックチェーン接続失敗:", error);
        return false;
    }
}

/**
 * Upload metadata to IPFS via Pinata
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
 * Generate enhanced NFT metadata
 */
function generateNFTMetadata(date, winner) {
    const dayOfWeek = dayjs(date).format('dddd');
    const monthName = dayjs(date).format('MMMM');
    
    return {
        name: `Today's NFT - ${date}`,
        description: `The NFT for ${date} (${dayOfWeek}). Winner: ${winner.wallet} with a bid of ${winner.price} MATIC. ${winner.message ? `Message: "${winner.message}"` : ''}`,
        image: `ipfs://QmYourImageHash/${date}.png`, // You can implement image generation
        external_url: `https://yourapp.com/nft/${date}`,
        attributes: [
            { trait_type: "Date", value: date },
            { trait_type: "Day of Week", value: dayOfWeek },
            { trait_type: "Month", value: monthName },
            { trait_type: "Year", value: dayjs(date).year().toString() },
            { trait_type: "Winner", value: winner.wallet },
            { trait_type: "Price (MATIC)", value: winner.price.toString() },
            { trait_type: "Bid Timestamp", value: winner.createdAt.toISOString() },
            { trait_type: "Has Message", value: winner.message ? "Yes" : "No" },
            { trait_type: "Message Length", value: winner.message ? winner.message.length.toString() : "0" }
        ],
        properties: {
            date: date,
            winner: winner.wallet,
            price: winner.price,
            currency: "MATIC",
            message: winner.message || null,
            generation_time: new Date().toISOString()
        }
    };
}

/**
 * Create Today's NFT for the previous day
 */
async function createTodayNFT() {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    
    try {
        console.log(`🎯 [${yesterday}] Daily NFT処理開始`);

        // Check if already processed
        const existingPending = await prisma.pendingMint.findUnique({
            where: { date: yesterday }
        });

        if (existingPending) {
            console.log(`⚠️  [${yesterday}] 既に処理済みです`);
            return;
        }

        // Find the winner (highest bidder)
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
            
            // Create a default NFT for the day with no winner
            const defaultMetadata = {
                name: `Today's NFT - ${yesterday} (No Winner)`,
                description: `No bids were placed for ${yesterday}. This NFT represents an unclaimed day.`,
                attributes: [
                    { trait_type: "Date", value: yesterday },
                    { trait_type: "Status", value: "No Winner" },
                    { trait_type: "Bids", value: "0" }
                ]
            };

            const metadataUrl = await uploadToIPFS(defaultMetadata, `today-nft-${yesterday}-no-winner.json`);
            
            await prisma.pendingMint.create({
                data: {
                    date: yesterday,
                    wallet: "0x0000000000000000000000000000000000000000", // Null address
                    price: 0,
                    metadataUrl,
                    minted: false
                }
            });

            console.log(`📝 [${yesterday}] No-winner NFTメタデータ作成完了`);
            return;
        }

        console.log(`🏆 [${yesterday}] 勝者: ${winner.wallet} (${winner.price} MATIC)`);

        // Generate and upload metadata
        const metadata = generateNFTMetadata(yesterday, winner);
        const metadataUrl = await uploadToIPFS(metadata, `today-nft-${yesterday}.json`);

        console.log(`📤 [${yesterday}] IPFS アップロード完了: ${metadataUrl}`);

        // Set pending winner on contract if available
        if (contract) {
            try {
                const tx = await contract.setPendingWinner(winner.wallet);
                await tx.wait();
                console.log(`✅ [${yesterday}] Contract pending winner設定完了: ${tx.hash}`);
            } catch (contractError) {
                console.error(`❌ [${yesterday}] Contract設定エラー:`, contractError);
                // Continue without failing the whole process
            }
        }

        // Create pending mint record
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

        // Attempt automatic minting if enabled
        await attemptAutoMint(yesterday);

    } catch (error) {
        console.error(`❌ [${yesterday}] Daily NFT作成エラー:`, error);
        
        // Send error notification (you can implement email/Discord/Slack notifications here)
        await notifyError(`Daily NFT creation failed for ${yesterday}`, error);
    }
}

/**
 * Attempt automatic minting
 */
async function attemptAutoMint(date) {
    if (!contract) {
        console.log(`⚠️  [${date}] Contract未接続のため自動mintをスキップ`);
        return;
    }

    try {
        console.log(`🔄 [${date}] 自動mint開始`);

        const pendingMint = await prisma.pendingMint.findUnique({
            where: { date }
        });

        if (!pendingMint || pendingMint.minted) {
            console.log(`⚠️  [${date}] PendingMintが見つからないか既にmint済み`);
            return;
        }

        // Check if already exists on blockchain
        const exists = await contract.exists(date);
        if (exists) {
            console.log(`⚠️  [${date}] ブロックチェーン上に既に存在`);
            
            // Update database to mark as minted
            await prisma.pendingMint.update({
                where: { date },
                data: { minted: true }
            });
            return;
        }

        // Skip minting for no-winner NFTs
        if (pendingMint.wallet === "0x0000000000000000000000000000000000000000") {
            console.log(`⚠️  [${date}] No-winner NFTのため自動mintをスキップ`);
            return;
        }

        // Check wallet balance
        const balance = await provider.getBalance(wallet.address);
        const requiredAmount = ethers.parseEther(pendingMint.price.toString());
        
        if (balance < requiredAmount) {
            console.warn(`⚠️  [${date}] Wallet残高不足: ${ethers.formatEther(balance)} < ${pendingMint.price}`);
            return;
        }

        // Execute mint
        const tx = await contract.mintToWinner(
            date,
            pendingMint.wallet,
            pendingMint.metadataUrl,
            { value: requiredAmount }
        );

        console.log(`⏳ [${date}] Mint transaction送信: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`✅ [${date}] NFT mint完了! Block: ${receipt.blockNumber}`);

        // Update database
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

        console.log(`💾 [${date}] Database更新完了`);

        // Send success notification
        await notifySuccess(`NFT successfully minted for ${date}`, {
            date,
            winner: pendingMint.wallet,
            price: pendingMint.price,
            txHash: tx.hash
        });

    } catch (error) {
        console.error(`❌ [${date}] 自動mint失敗:`, error);
        
        // Don't fail the whole process, just log and notify
        await notifyError(`Auto-mint failed for ${date}`, error);
    }
}

/**
 * Manual mint trigger for failed automatic attempts
 */
async function retryFailedMints() {
    console.log("🔄 Failed mints再試行開始");

    const failedMints = await prisma.pendingMint.findMany({
        where: {
            minted: false,
            wallet: { not: "0x0000000000000000000000000000000000000000" }, // Exclude no-winner NFTs
            createdAt: {
                lt: dayjs().subtract(1, 'hour').toDate() // Only retry after 1 hour
            }
        },
        orderBy: { createdAt: 'asc' },
        take: 5 // Limit to 5 retries per run
    });

    for (const pendingMint of failedMints) {
        console.log(`🔄 [${pendingMint.date}] Mint再試行`);
        await attemptAutoMint(pendingMint.date);
        
        // Wait 30 seconds between attempts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 30000));
    }

    console.log("✅ Failed mints再試行完了");
}

/**
 * Clean up old data (optional)
 */
async function cleanupOldData() {
    const cutoffDate = dayjs().subtract(90, 'days').toDate(); // Keep 90 days
    
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
 * Error notification system
 */
async function notifyError(message, error) {
    console.error(`📧 Error notification: ${message}`, error);
    
    // Here you can implement:
    // - Email notifications
    // - Discord webhook
    // - Slack webhook
    // - Database logging
    
    try {
        // Example: Log to database
        // await prisma.errorLog.create({
        //     data: {
        //         message,
        //         error: error.toString(),
        //         timestamp: new Date()
        //     }
        // });
    } catch (logError) {
        console.error("Failed to log error:", logError);
    }
}

/**
 * Success notification system
 */
async function notifySuccess(message, data) {
    console.log(`📧 Success notification: ${message}`, data);
    
    // Here you can implement success notifications
    // - Discord webhook for successful mints
    // - Twitter bot to announce daily winners
    // - Email notifications to winners
}

/**
 * Health check and status report
 */
async function healthCheck() {
    const report = {
        timestamp: new Date().toISOString(),
        blockchain: {
            connected: !!contract,
            contractAddress: CONTRACT_ADDRESS,
            walletAddress: wallet?.address
        },
        ipfs: {
            configured: !!(PINATA_API_KEY && PINATA_API_SECRET_KEY)
        },
        database: {
            connected: true // If we reach here, DB is connected
        }
    };

    console.log("🔍 Health check:", JSON.stringify(report, null, 2));
    return report;
}

// Initialize blockchain connection on startup
const blockchainReady = initializeBlockchain();

// =====================================================================
// CRON JOBS SCHEDULE
// =====================================================================

// Daily NFT creation at midnight (00:01)
cron.schedule('1 0 * * *', async () => {
    console.log("⏰ Daily NFT creation job開始");
    await createTodayNFT();
}, {
    timezone: "Asia/Tokyo"
});

// Retry failed mints every 2 hours
cron.schedule('0 */2 * * *', async () => {
    console.log("⏰ Failed mints retry job開始");
    await retryFailedMints();
});

// Health check every hour
cron.schedule('0 * * * *', async () => {
    await healthCheck();
});

// Weekly cleanup on Sundays at 2 AM
cron.schedule('0 2 * * 0', async () => {
    console.log("⏰ Weekly cleanup job開始");
    await cleanupOldData();
}, {
    timezone: "Asia/Tokyo"
});

// =====================================================================
// STARTUP CHECKS
// =====================================================================

console.log("🚀 Cron system初期化完了");
console.log("📅 Daily NFT creation: 毎日 00:01 (JST)");
console.log("🔄 Failed mints retry: 2時間ごと");
console.log("🔍 Health check: 1時間ごと");
console.log("🧹 Data cleanup: 毎週日曜 02:00 (JST)");

if (!blockchainReady) {
    console.warn("⚠️  ブロックチェーン接続なしで開始 - メタデータ作成のみ可能");
}

// Initial health check
setTimeout(healthCheck, 5000);

// Export functions for manual testing
export {
    createTodayNFT,
    attemptAutoMint,
    retryFailedMints,
    healthCheck,
    cleanupOldData
};




