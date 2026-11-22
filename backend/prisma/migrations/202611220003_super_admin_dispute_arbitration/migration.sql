ALTER TABLE `EscrowRecord`
    ADD COLUMN `adminResponse` TEXT NULL,
    ADD COLUMN `adminRespondedAt` DATETIME(3) NULL,
    ADD COLUMN `adminRespondedByUserId` VARCHAR(191) NULL,
    ADD COLUMN `resolutionNotes` TEXT NULL,
    ADD COLUMN `arbitratedAt` DATETIME(3) NULL,
    ADD COLUMN `arbitratedByUserId` VARCHAR(191) NULL,
    ADD INDEX `EscrowRecord_adminRespondedByUserId_idx`(`adminRespondedByUserId`),
    ADD INDEX `EscrowRecord_arbitratedByUserId_idx`(`arbitratedByUserId`),
    ADD CONSTRAINT `EscrowRecord_adminRespondedByUserId_fkey`
        FOREIGN KEY (`adminRespondedByUserId`) REFERENCES `User`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `EscrowRecord_arbitratedByUserId_fkey`
        FOREIGN KEY (`arbitratedByUserId`) REFERENCES `User`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
