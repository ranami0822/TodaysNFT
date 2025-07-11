-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wallet" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PendingMint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "metadataUrl" TEXT NOT NULL,
    "minted" BOOLEAN NOT NULL DEFAULT false,
    "txHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mintedAt" DATETIME
);

-- CreateTable
CREATE TABLE "NFT" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "tokenId" INTEGER,
    "winner" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "metadataUrl" TEXT NOT NULL,
    "txHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingMint_date_key" ON "PendingMint"("date");

-- CreateIndex
CREATE UNIQUE INDEX "NFT_date_key" ON "NFT"("date");
