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
const PORT = 3000;

// Blockchain configuration
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Contract owner's private key
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const POL_TOKEN_ADDRESS = process.env.POL_TOKEN_ADDRESS || '0x455e53BAaC5d24EeD4b1424D9B1a26fF6B8Eef9C'; // POL token on Polygon

// POL token ABI (simplified for transfer functions)
const POL_TOKEN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

// TodaysNFT contract ABI (simplified)
const NFT_CONTRACT_ABI = [
    "function mintToWinner(string memory date, address winner, uint256 price, string memory metadataUri) external",
    "function emergencyMint(string memory date, address winner, string memory metadataUri) external",
    "function exists(string memory date) external view returns (bool)",
    "function getAuctionInfo(string memory date) external view returns (tuple(address winner, uint256 price, bool minted, string metadataUri))"
];

let provider, wallet, nftContract, polContract;

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
        polContract = new ethers.Contract(POL_TOKEN_ADDRESS, POL_TOKEN_ABI, provider);
        console.log("✅ Blockchain connection initialized");
    } catch (error) {
        console.error("❌ Failed to initialize blockchain connection:", error);
    }
}

initializeBlockchain();

app.use(express.static('public'));
app.get('/hello', (req, res) => {
    res.send("こんにちは！サーバーが起動しました。");
})
app.get("/api/winner", async (req, res) => {
    try {
        const winner = await prisma.auctionBid.findFirst(
            {
                orderBy: {
                    price: 'desc'
                },

            }
        );

        if (!winner) {
            return res.status(404).json({ message: "入札がありません。" });
        }
        res.json(
            {
                wallet: winner.wallet,
                price: winner.price,
                createdAt: winner.createdAt
            }
        )
    } catch (error) {
        console.error("winnner取得エラー:", error);
        res.status(500).json({ message: "内部サーバーエラー" });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const bids = await prisma.auctionBid.findMany(
            {
                orderBy: {
                    createdAt: 'desc'
                }
            }
        );
        res.json(
            bids
        );
    } catch (error) {
        console.error("入札履歴取得エラー:", error);
        res.status(500).json({ error: "内部サーバーエラー" });
    }
});
io.on('connection', (socket) => {
    console.log("client connnected:", socket.id);

    socket.on(
        'bid',
        async (data) => {
            try {
                console.log("入札きた", data);

                // 入力値のバリデーション
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

                const saved = await prisma.auctionBid.create(
                    {
                        data: {
                            wallet: data.wallet,
                            price: parseInt(data.price)
                        },
                    }
                );
                console.log("入札保存完了", saved);
                io.emit('new-bid', saved);
            } catch (err) {
                console.error("入札保存エラー:", err);
                socket.emit('bid-error', { message: 'サーバーエラー: 入札できませんでした。' });
            }
        }
    );

    // 必要ならdisconnectイベントも追加
    // socket.on('disconnect', () => {
    //     console.log("client disconnected:", socket.id);
    // });
})

httpServer.listen(
    PORT,
    () => {
        console.log(`サーバーがポート ${PORT} で起動しました。http://localhost:${PORT}`);
    }
)

app.post("/api/request-signature", express.json(), async (req, res)=> {
    const {wallet} = req.body;

    if(!wallet) return res.status(400).json({message: "ウォレットアドレスが必要です。"});

    const nonce = Math.floor(Math.random()* 1_000_000);
    const message = `ログイン確認: ${nonce}`;

    res.json({message});
});

app.post("/api/verify-signature", express.json(), async (req, res) => {
    console.log("署名検証リクエスト:", req.body);
    
    const {wallet, message, signature} = req.body;
    if (!wallet || !message || !signature) {
        return res.status(400).json({ok: false, message: "ウォレットアドレス、メッセージ、署名が必要です。"});
    }

    try{
        const signerAddress = verifyMessage(message, signature);
        if (signerAddress.toLowerCase() === wallet.toLowerCase()) {
            return res.json({ok: true});

        }else{
            return res.status(401).json({ok: false, message:"署名が一致しません。"});
        }
    }catch(error){
        console.error("署名検証エラー:", error);
        return res.status(500).json({ok: false, message:"内部サーバーエラー"});
    }
})

app.get('/api/today', async (req, res) => {
  const today = dayjs().format('YYYY-MM-DD')
  const nft = await prisma.nft.findUnique({ where: { date: today } })
  if (!nft) return res.status(404).json({ message: 'まだ生成されていません' })
  res.json(nft)
})

// Check POL balance and allowance for a wallet
app.post('/api/check-payment-capability', async (req, res) => {
    const { wallet, amount } = req.body;
    
    if (!wallet || !amount) {
        return res.status(400).json({ ok: false, message: 'ウォレットアドレスと金額が必要です' });
    }
    
    if (!polContract) {
        return res.status(503).json({ ok: false, message: 'ブロックチェーン接続が利用できません' });
    }
    
    try {
        const amountWei = ethers.parseUnits(amount.toString(), 18); // POL has 18 decimals
        const balance = await polContract.balanceOf(wallet);
        const allowance = await polContract.allowance(wallet, CONTRACT_ADDRESS);
        
        const canPay = balance >= amountWei && allowance >= amountWei;
        
        res.json({
            ok: true,
            canPay,
            balance: ethers.formatUnits(balance, 18),
            allowance: ethers.formatUnits(allowance, 18),
            required: amount
        });
    } catch (error) {
        console.error('支払い能力確認エラー:', error);
        res.status(500).json({ ok: false, message: '内部サーバーエラー' });
    }
});

// Enhanced bid endpoint with payment verification
app.post('/api/bid-with-payment', async (req, res) => {
    const { wallet, price, signature, message } = req.body;
    
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
        
        // Check POL payment capability if blockchain is available
        if (polContract) {
            const amountWei = ethers.parseUnits(price.toString(), 18);
            const balance = await polContract.balanceOf(wallet);
            const allowance = await polContract.allowance(wallet, CONTRACT_ADDRESS);
            
            if (balance < amountWei) {
                return res.status(400).json({ ok: false, message: 'POL残高が不足しています' });
            }
            
            if (allowance < amountWei) {
                return res.status(400).json({ 
                    ok: false, 
                    message: 'POLの使用許可が不足しています。approveを実行してください',
                    needsApproval: true,
                    contractAddress: CONTRACT_ADDRESS
                });
            }
        }
        
        // Save bid to database
        const saved = await prisma.auctionBid.create({
            data: {
                wallet: wallet,
                price: parseInt(price)
            }
        });
        
        console.log("✅ 支払い確認済み入札保存完了", saved);
        
        // Broadcast to all clients
        io.emit('new-bid', saved);
        
        res.json({ ok: true, bid: saved });
        
    } catch (error) {
        console.error('入札エラー:', error);
        res.status(500).json({ ok: false, message: 'サーバーエラー: 入札できませんでした' });
    }
});

// Execute NFT mint for pending mints
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
        const pendingMint = await prisma.PendingMint.findUnique({
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
        
        const priceWei = ethers.parseUnits(pendingMint.price.toString(), 18);
        const tx = await nftContract.mintToWinner(
            date,
            pendingMint.wallet,
            priceWei,
            pendingMint.metadataUrl
        );
        
        console.log(`⏳ Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ NFT minted successfully! Block: ${receipt.blockNumber}`);
        
        // Update database to mark as minted
        await prisma.PendingMint.update({
            where: { date: date },
            data: { 
                // You might want to add a 'minted' boolean field to the schema
                metadataUrl: `${pendingMint.metadataUrl} - MINTED:${tx.hash}`
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
        
        if (error.message.includes('Insufficient POL balance')) {
            res.status(400).json({ ok: false, message: '落札者のPOL残高が不足しています' });
        } else if (error.message.includes('POL transfer failed')) {
            res.status(400).json({ ok: false, message: 'POLの転送に失敗しました。allowanceを確認してください' });
        } else {
            res.status(500).json({ ok: false, message: 'NFTのmintに失敗しました', error: error.message });
        }
    }
});

// Get mint status for a date
app.get('/api/mint-status/:date', async (req, res) => {
    const { date } = req.params;
    
    try {
        const pendingMint = await prisma.PendingMint.findUnique({
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
                        winner: auctionInfo.winner,
                        price: ethers.formatUnits(auctionInfo.price, 18),
                        minted: auctionInfo.minted,
                        metadataUri: auctionInfo.metadataUri
                    };
                }
            } catch (error) {
                console.warn('ブロックチェーン状態確認エラー:', error);
            }
        }
        
        res.json({
            pendingMint,
            blockchainStatus
        });
        
    } catch (error) {
        console.error('Mint状態確認エラー:', error);
        res.status(500).json({ ok: false, message: '内部サーバーエラー' });
    }
});