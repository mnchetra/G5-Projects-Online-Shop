CREATE TABLE `EscrowEvidence` (
    `id` VARCHAR(191) NOT NULL,
    `escrowId` VARCHAR(191) NOT NULL,
    `uploaderUserId` VARCHAR(191) NOT NULL,
    `stage` ENUM('CUSTOMER', 'ADMIN', 'SUPER_ADMIN') NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `EscrowEvidence_filename_key`(`filename`),
    INDEX `EscrowEvidence_escrowId_createdAt_idx`(`escrowId`, `createdAt`),
    INDEX `EscrowEvidence_uploaderUserId_idx`(`uploaderUserId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `EscrowEvidence_escrowId_fkey`
        FOREIGN KEY (`escrowId`) REFERENCES `EscrowRecord`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `EscrowEvidence_uploaderUserId_fkey`
        FOREIGN KEY (`uploaderUserId`) REFERENCES `User`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
