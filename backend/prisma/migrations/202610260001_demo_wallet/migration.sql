-- Add database-backed demo wallet balances and immutable activity history.
ALTER TABLE `order` MODIFY `paymentMethod` ENUM('CASH_ON_DELIVERY', 'ABA_KHQR', 'BAKONG_ESCROW', 'DEMO_WALLET') NOT NULL DEFAULT 'CASH_ON_DELIVERY';

ALTER TABLE `payment` MODIFY `method` ENUM('CASH_ON_DELIVERY', 'ABA_KHQR', 'BAKONG_ESCROW', 'DEMO_WALLET') NOT NULL;

ALTER TABLE `user` ADD COLUMN `walletBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

CREATE TABLE `WalletTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `type` ENUM('ADMIN_CREDIT', 'ADMIN_DEBIT', 'ORDER_HOLD', 'ORDER_RELEASE', 'ORDER_REFUND') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `balanceAfter` DECIMAL(12, 2) NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `WalletTransaction_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `WalletTransaction_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
