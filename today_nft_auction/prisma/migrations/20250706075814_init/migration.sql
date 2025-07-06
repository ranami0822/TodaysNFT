-- CreateTable
CREATE TABLE "PendingMint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "metadataUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingMint_date_key" ON "PendingMint"("date");
