import cron from 'node-cron';
import dayjs from 'dayjs';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET_KEY = process.env.PINATA_API_SECRET_KEY;

/**
 * Create Today NFT
 *
 *  1    NFT
 *      1   NFT
 *      IPFS 
 *      PendingMint 
 *
 * @return {Promise<void>}
 */
async function createToDayNFT() {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const winner = await prisma.auctionBid.findFirst({
        where: {
            createdAt: {
                gte: new Date(`${yesterday}T00:00:00.000Z`),
                lt: new Date(`${dayjs(yesterday).add(1, 'day').format('YYYY-MM-DD')}T00:00:00.000Z`),
            },

            },
            orderBy: {
                price: 'desc'
            }
    });
    if (!winner) {
        console.log("入札者がいません");
        return;
    }
    const metadata = {
        name: `Today NFT ${yesterday}`,
        description: winner.message || `Winner: ${winner.wallet}`,
        attributes: [
            {trait_type: "Date", value: yesterday},
            {trait_type: "Price", value: winner.price},
            {trait_type: "Winner", value: winner.wallet},
        ]
    }

    const res = await axios.post(
  "https://api.pinata.cloud/pinning/pinJSONToIPFS",
  {
    pinataContent: metadata,
    pinataMetadata: {
      name: `today-nft-${yesterday}.json`
    },
    pinataOptions: {
      cidVersion: 1
    }
  },
  {
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_API_SECRET_KEY
    }
  }
);

    const ipfsHash = res.data.IpfsHash;
    const metadataUrl = `ipfs://${ipfsHash}`;

    await prisma.PendingMint.create({
        data: {
            date: yesterday,
            wallet: winner.wallet,
            price: winner.price,
            metadataUrl
        }
    });
    console.log(`[${yesterday}] NFT metadata アップ完了: ${metadataUrl}`);

} 


cron.schedule('0 0 * * *', async () => {
  await createToDayNFT();
});




