-- AlterTable
ALTER TABLE `wallettransaction` ADD COLUMN `walletTopUpId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('ADMIN_CREDIT', 'ADMIN_DEBIT', 'KHQR_TOP_UP', 'ORDER_HOLD', 'ORDER_RELEASE', 'ORDER_REFUND') NOT NULL;

-- CreateTable
CREATE TABLE `WalletTopUp` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `billNumber` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `providerRef` VARCHAR(191) NULL,
    `qrString` TEXT NULL,
    `qrImage` TEXT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WalletTopUp_billNumber_key`(`billNumber`),
    UNIQUE INDEX `WalletTopUp_providerRef_key`(`providerRef`),
    INDEX `WalletTopUp_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
    INDEX `WalletTopUp_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `WalletTransaction_walletTopUpId_key` ON `WalletTransaction`(`walletTopUpId`);

-- AddForeignKey
ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_walletTopUpId_fkey` FOREIGN KEY (`walletTopUpId`) REFERENCES `WalletTopUp`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WalletTopUp` ADD CONSTRAINT `WalletTopUp_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
