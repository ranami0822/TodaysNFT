import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { verifyMessage, ethers } from 'ethers';
import cors from 'cors';
import dayjs from 'dayjs';
import "./cron.js"; // Import the cron job to ensure it runs

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();
const io = new Server(
    httpServer,
    {
        cors: {
            origin: "*",
        },
    }
);

app.use(cors())
app.use(express.json())
const PORT = process.env.PORT || 3000;

// Blockchain configuration
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// Enhanced TodaysNFT contract ABI
const NFT_CONTRACT_ABI = [
    "function mintToWinner(string memory date, address winner, string memory metadataUri) external payable",
    "function emergencyMint(string memory date, address winner, string memory metadataUri) external",
    "function exists(string memory date) external view returns (bool)",
    "function getAuctionInfo(string memory date) external view returns (tuple(uint256 tokenId, address winner, uint256 price, bool minted, string metadataUri, uint256 mintTimestamp, uint256 auctionEndTime))",
    "function setPendingWinner(address winner) external",
    "function removePendingWinner(address winner) external",
    "function pendingWinners(address) external view returns (bool)",
    "function getMonthlyCalendar(uint256 year, uint256 month) external view returns (bool[] memory daysWithNFTs, address[] memory winners)",
    "function getNFTsByOwner(address owner) external view returns (uint256[] memory tokenIds, string[] memory dates)",
    "function getCurrentTokenId() external view returns (uint256)",
    "function treasuryWallet() external view returns (address)",
    "function auctionConfig() external view returns (tuple(uint256 startTime, uint256 duration, uint256 minBidIncrement, bool autoMintEnabled))"
];

let provider, wallet, nftContract;

// Initialize blockchain connection
function initializeBlockchain() {
    if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
        console.warn("⚠️  Blockchain configuration missing. Smart contract features disabled.");
        return;
    }
    
    try {
        provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        nftContract = new ethers.Contract(CONTRACT_ADDRESS, NFT_CONTRACT_ABI, wallet);
        console.log("✅ Blockchain connection initialized");
        console.log("📍 Contract Address:", CONTRACT_ADDRESS);
        console.log("🔑 Wallet Address:", wallet.address);
    } catch (error) {
        console.error("❌ Failed to initialize blockchain connection:", error);
    }
}

initializeBlockchain();

// Serve static files
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        contract: CONTRACT_ADDRESS ? 'connected' : 'not configured',
        blockchain: nftContract ? 'ready' : 'not ready'
    });
});

app.get('/hello', (req, res) => {
    res.send("こんにちは！Today's NFT サーバーが起動しました。");
})

// =============================================================================
// AUCTION ENDPOINTS
// =============================================================================

app.get("/api/winner/:date?", async (req, res) => {
    try {
        const date = req.params.date || dayjs().format('YYYY-MM-DD');
        
        const winner = await prisma.auctionBid.findFirst({
            where: { date: date },
            orderBy: { price: 'desc' }
        });

        if (!winner) {
            return res.status(404).json({ message: "入札がありません。", date });
        }
        
        res.json({
            wallet: winner.wallet,
            price: winner.price,
            createdAt: winner.createdAt,
            message: winner.message || "",
            date: winner.date
        });
    } catch (error) {
        console.error("Winner取得エラー:", error);
        res.status(500).json({ message: "内部サーバーエラー" });
    }
});

app.get('/api/history/:date?', async (req, res) => {
    try {
        const date = req.params.date || dayjs().format('YYYY-MM-DD');
        
        const bids = await prisma.auctionBid.findMany({
            where: { date: date },
            orderBy: { createdAt: 'desc' }
        });
        
        res.json({ bids, date, count: bids.length });
    } catch (error) {
        console.error("入札履歴取得エラー:", error);
        res.status(500).json({ error: "内部サーバーエラー" });
    }
});

// =============================================================================
// CALENDAR ENDPOINTS
// =============================================================================

app.get('/api/calendar/:year/:month', async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);
        
        if (year < 2020 || year > 2030 || month < 1 || month > 12) {
            return res.status(400).json({ message: "無効な年月です" });
        }
        
        // Get blockchain calendar data if available
        let blockchainCalendar = null;
        if (nftContract) {
            try {
                const [daysWithNFTs, winners] = await nftContract.getMonthlyCalendar(year, month);
                blockchainCalendar = {
                    daysWithNFTs: daysWithNFTs.map(Boolean),
                    winners: winners
                };
            } catch (error) {
                console.warn("ブロックチェーンカレンダー取得エラー:", error);
            }
        }
        
        // Get database calendar data
        const daysInMonth = dayjs(`${year}-${month.toString().padStart(2, '0')}-01`).daysInMonth();
        const databaseCalendar = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            
            // Get winner for this date
            const winner = await prisma.auctionBid.findFirst({
                where: { date },
                orderBy: { price: 'desc' }
            });
            
            // Get NFT info if exists
            const nft = await prisma.nft.findUnique({
                where: { date }
            });
            
            databaseCalendar.push({
                date,
                day,
                hasWinner: !!winner,
                winner: winner ? {
                    wallet: winner.wallet,
                    price: winner.price,
                    message: winner.message
                } : null,
                nft: nft ? {
                    tokenId: nft.tokenId,
                    metadataUrl: nft.metadataUrl,
                    txHash: nft.txHash
                } : null,
                hasBids: !!winner
            });
        }
        
        res.json({
            year,
            month,
            daysInMonth,
            calendar: databaseCalendar,
            blockchainCalendar
        });
        
    } catch (error) {
        console.error("カレンダー取得エラー:", error);
        res.status(500).json({ error: "内部サーバーエラー" });
    }
});

// Get current month calendar
app.get('/api/calendar/current', async (req, res) => {
    const now = dayjs();
    const year = now.year();
    const month = now.month() + 1;
    
    // Redirect to the specific calendar endpoint
    req.params.year = year.toString();
    req.params.month = month.toString();
    
    // Call the calendar endpoint logic
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/calendar/${year}/${month}`);
    const data = await response.json();
    res.json(data);
});

// =============================================================================
// NFT ENDPOINTS
// =============================================================================

app.get('/api/today', async (req, res) => {
    const today = dayjs().format('YYYY-MM-DD');
    try {
        // Check database first
        const nft = await prisma.nft.findUnique({ where: { date: today } });
        
        // If not in database, check blockchain
        let blockchainInfo = null;
        if (nftContract) {
            try {
                const exists = await nftContract.exists(today);
                if (exists) {
                    blockchainInfo = await nftContract.getAuctionInfo(today);
                }
            } catch (error) {
                console.warn("ブロックチェーンNFT確認エラー:", error);
            }
        }
        
        if (!nft && !blockchainInfo) {
            return res.status(404).json({ message: 'まだ生成されていません', date: today });
        }
        
        res.json({
            database: nft,
            blockchain: blockchainInfo,
            date: today
        });
    } catch (error) {
        console.error("Today NFT取得エラー:", error);
        res.status(500).json({ message: "内部サーバーエラー" });
    }
});

app.get("/api/pending/:wallet", async (req, res) => {
    const { wallet } = req.params;
    if (!wallet) {
        return res.status(400).json({ message: "walletが必要です" });
    }

    try {
        const pending = await prisma.pendingMint.findFirst({
            where: { wallet: wallet.toLowerCase() }
        });
        
        if (!pending) {
            return res.status(404).json({ message: "mint対象ではありません" });
        }

        // Check blockchain status if available
        let blockchainStatus = null;
        if (nftContract) {
            try {
                const isPending = await nftContract.pendingWinners(wallet);
                blockchainStatus = { isPendingOnContract: isPending };
            } catch (error) {
                console.warn("ブロックチェーン状態確認エラー:", error);
            }
        }

        res.json({
            metadataUrl: pending.metadataUrl,
            date: pending.date,
            price: pending.price,
            minted: pending.minted,
            txHash: pending.txHash,
            blockchainStatus
        });
    } catch (error) {
        console.error("Pending取得エラー:", error);
        res.status(500).json({ message: "内部サーバーエラー" });
    }
});

// Get user's NFT collection
app.get('/api/collection/:wallet', async (req, res) => {
    const { wallet } = req.params;
    
    if (!wallet || !ethers.isAddress(wallet)) {
        return res.status(400).json({ message: "有効なウォレットアドレスが必要です" });
    }
    
    try {
        let blockchainNFTs = [];
        
        if (nftContract) {
            try {
                const [tokenIds, dates] = await nftContract.getNFTsByOwner(wallet);
                blockchainNFTs = tokenIds.map((tokenId, index) => ({
                    tokenId: tokenId.toString(),
                    date: dates[index]
                }));
            } catch (error) {
                console.warn("ブロックチェーンコレクション取得エラー:", error);
            }
        }
        
        // Get database NFTs for this wallet
        const databaseNFTs = await prisma.nft.findMany({
            where: { winner: wallet.toLowerCase() },
            orderBy: { createdAt: 'desc' }
        });
        
        res.json({
            wallet,
            blockchainNFTs,
            databaseNFTs,
            totalCount: blockchainNFTs.length
        });
        
    } catch (error) {
        console.error("コレクション取得エラー:", error);
        res.status(500).json({ message: "内部サーバーエラー" });
    }
});

// =============================================================================
// BIDDING ENDPOINTS
// =============================================================================

app.post("/api/request-signature", express.json(), async (req, res) => {
    const { wallet } = req.body;

    if (!wallet || !ethers.isAddress(wallet)) {
        return res.status(400).json({ message: "有効なウォレットアドレスが必要です。" });
    }

    const nonce = Math.floor(Math.random() * 1_000_000);
    const timestamp = Date.now();
    const message = `Today's NFT ログイン確認\nNonce: ${nonce}\nTimestamp: ${timestamp}\nWallet: ${wallet}`;

    res.json({ message, nonce, timestamp });
});

app.post("/api/verify-signature", express.json(), async (req, res) => {
    console.log("署名検証リクエスト:", req.body);
    
    const { wallet, message, signature } = req.body;
    if (!wallet || !message || !signature) {
        return res.status(400).json({ ok: false, message: "ウォレットアドレス、メッセージ、署名が必要です。" });
    }

    try {
        const signerAddress = verifyMessage(message, signature);
        if (signerAddress.toLowerCase() === wallet.toLowerCase()) {
            return res.json({ ok: true });
        } else {
            return res.status(401).json({ ok: false, message: "署名が一致しません。" });
        }
    } catch (error) {
        console.error("署名検証エラー:", error);
        return res.status(500).json({ ok: false, message: "内部サーバーエラー" });
    }
});

app.post('/api/bid', async (req, res) => {
    const { wallet, price, signature, message, bidMessage, date } = req.body;
    
    const targetDate = date || dayjs().format('YYYY-MM-DD');
    
    if (!wallet || !price || !signature || !message) {
        return res.status(400).json({ ok: false, message: '必要な情報が不足しています' });
    }
    
    if (price <= 0) {
        return res.status(400).json({ ok: false, message: '価格は1以上である必要があります' });
    }
    
    try {
        // Verify signature first
        const signerAddress = verifyMessage(message, signature);
        if (signerAddress.toLowerCase() !== wallet.toLowerCase()) {
            return res.status(401).json({ ok: false, message: '署名が一致しません' });
        }
        
        // Check if auction is still active (you can add time-based logic here)
        const auctionEndTime = dayjs(targetDate).add(1, 'day').startOf('day');
        if (dayjs().isAfter(auctionEndTime)) {
            return res.status(400).json({ ok: false, message: 'オークション時間が終了しています' });
        }
        
        // Save bid to database
        const saved = await prisma.auctionBid.create({
            data: {
                wallet: wallet.toLowerCase(),
                price: parseInt(price),
                date: targetDate,
                message: bidMessage || ""
            }
        });
        
        console.log("✅ 入札保存完了", saved);
        
        // Broadcast to all clients
        io.emit('new-bid', {
            ...saved,
            isNewHighest: true // You can add logic to determine this
        });
        
        res.json({ ok: true, bid: saved });
        
    } catch (error) {
        console.error('入札エラー:', error);
        res.status(500).json({ ok: false, message: 'サーバーエラー: 入札できませんでした' });
    }
});

// =============================================================================
// MINTING ENDPOINTS
// =============================================================================

app.post('/api/execute-mint', async (req, res) => {
    const { date } = req.body;
    
    if (!date) {
        return res.status(400).json({ ok: false, message: '日付が必要です' });
    }
    
    if (!nftContract) {
        return res.status(503).json({ ok: false, message: 'スマートコントラクト接続が利用できません' });
    }
    
    try {
        // Check if there's a pending mint for this date
        const pendingMint = await prisma.pendingMint.findUnique({
            where: { date: date }
        });
        
        if (!pendingMint) {
            return res.status(404).json({ ok: false, message: '指定された日付のPendingMintが見つかりません' });
        }
        
        // Check if already minted on blockchain
        const exists = await nftContract.exists(date);
        if (exists) {
            return res.status(400).json({ ok: false, message: 'この日付のNFTは既にmint済みです' });
        }
        
        // Execute mint transaction
        console.log(`🔄 Minting NFT for ${date} to ${pendingMint.wallet}...`);
        
        const priceWei = ethers.parseEther(pendingMint.price.toString());
        const tx = await nftContract.mintToWinner(
            date,
            pendingMint.wallet,
            pendingMint.metadataUrl,
            { value: priceWei }
        );
        
        console.log(`⏳ Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ NFT minted successfully! Block: ${receipt.blockNumber}`);
        
        // Update database to mark as minted
        await prisma.pendingMint.update({
            where: { date: date },
            data: { 
                minted: true,
                txHash: tx.hash,
                mintedAt: new Date()
            }
        });
        
        // Create NFT record
        await prisma.nft.upsert({
            where: { date: date },
            update: {
                txHash: tx.hash
            },
            create: {
                date: date,
                winner: pendingMint.wallet,
                price: pendingMint.price,
                metadataUrl: pendingMint.metadataUrl,
                txHash: tx.hash
            }
        });
        
        res.json({
            ok: true,
            message: 'NFTのmintが完了しました',
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
        });
        
    } catch (error) {
        console.error('NFT mint エラー:', error);
        
        if (error.message.includes('insufficient funds')) {
            res.status(400).json({ ok: false, message: 'MATIC残高が不足しています' });
        } else if (error.message.includes('Payment must be greater than 0')) {
            res.status(400).json({ ok: false, message: '支払い額は0より大きい必要があります' });
        } else {
            res.status(500).json({ ok: false, message: 'NFTのmintに失敗しました', error: error.message });
        }
    }
});

// Get mint status for a date
app.get('/api/mint-status/:date', async (req, res) => {
    const { date } = req.params;
    
    try {
        const pendingMint = await prisma.pendingMint.findUnique({
            where: { date: date }
        });
        
        let blockchainStatus = null;
        if (nftContract) {
            try {
                const exists = await nftContract.exists(date);
                if (exists) {
                    const auctionInfo = await nftContract.getAuctionInfo(date);
                    blockchainStatus = {
                        exists: true,
                        tokenId: auctionInfo.tokenId.toString(),
                        winner: auctionInfo.winner,
                        price: ethers.formatEther(auctionInfo.price),
                        minted: auctionInfo.minted,
                        metadataUri: auctionInfo.metadataUri,
                        mintTimestamp: auctionInfo.mintTimestamp.toString()
                    };
                }
            } catch (error) {
                console.warn('ブロックチェーン状態確認エラー:', error);
            }
        }
        
        res.json({
            date,
            pendingMint,
            blockchainStatus
        });
        
    } catch (error) {
        console.error('Mint状態確認エラー:', error);
        res.status(500).json({ ok: false, message: '内部サーバーエラー' });
    }
});

// =============================================================================
// STATISTICS ENDPOINTS
// =============================================================================

app.get('/api/stats', async (req, res) => {
    try {
        const totalBids = await prisma.auctionBid.count();
        const totalPendingMints = await prisma.pendingMint.count();
        const totalNFTs = await prisma.nft.count();
        const uniqueBidders = await prisma.auctionBid.groupBy({
            by: ['wallet'],
            _count: true
        });
        
        let contractStats = null;
        if (nftContract) {
            try {
                const currentTokenId = await nftContract.getCurrentTokenId();
                const treasuryWallet = await nftContract.treasuryWallet();
                contractStats = {
                    totalMinted: currentTokenId.toString(),
                    treasuryWallet
                };
            } catch (error) {
                console.warn("コントラクト統計取得エラー:", error);
            }
        }
        
        res.json({
            totalBids,
            totalPendingMints,
            totalNFTs,
            uniqueBidders: uniqueBidders.length,
            contractStats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('統計取得エラー:', error);
        res.status(500).json({ error: '内部サーバーエラー' });
    }
});

// =============================================================================
// WEBSOCKET HANDLING
// =============================================================================

io.on('connection', (socket) => {
    console.log("Client connected:", socket.id);

    socket.on('bid', async (data) => {
        try {
            console.log("入札データ受信", data);

            // Input validation
            if (
                !data.wallet ||
                typeof data.wallet !== 'string' ||
                !data.price ||
                isNaN(Number(data.price)) ||
                Number(data.price) <= 0
            ) {
                socket.emit('bid-error', { message: 'ウォレットアドレスと価格を正しく入力してください。' });
                return;
            }

            const targetDate = data.date || dayjs().format('YYYY-MM-DD');

            const saved = await prisma.auctionBid.create({
                data: {
                    wallet: data.wallet.toLowerCase(),
                    price: parseInt(data.price),
                    date: targetDate,
                    message: data.message || ""
                }
            });
            
            console.log("入札保存完了", saved);
            io.emit('new-bid', saved);
        } catch (err) {
            console.error("入札保存エラー:", err);
            socket.emit('bid-error', { message: 'サーバーエラー: 入札できませんでした。' });
        }
    });

    socket.on('disconnect', () => {
        console.log("Client disconnected:", socket.id);
    });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

httpServer.listen(PORT, () => {
    console.log(`🚀 Today's NFT サーバーがポート ${PORT} で起動しました。`);
    console.log(`📱 UI: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/`);
    console.log(`💰 Contract: ${CONTRACT_ADDRESS || 'Not configured'}`);
    
    if (!CONTRACT_ADDRESS || !PRIVATE_KEY) {
        console.warn("⚠️  警告: ブロックチェーン設定が不完全です。.envファイルを確認してください。");
    }
});
