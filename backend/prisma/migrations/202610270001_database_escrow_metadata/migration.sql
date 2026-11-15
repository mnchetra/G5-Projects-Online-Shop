-- Remove placeholder EVM-looking details produced by the former database simulation.
UPDATE `escrowrecord`
SET `contractAddress` = 'DATABASE_STATUS_ONLY',
    `contractNetwork` = 'Database demo only - no real funds',
    `buyerAddress` = 'NOT_ON_CHAIN',
    `sellerAddress` = 'NOT_ON_CHAIN',
    `arbiterAddress` = 'NOT_ON_CHAIN',
    `txHash` = NULL,
    `releaseTxHash` = NULL,
    `refundTxHash` = NULL;

ALTER TABLE `escrowrecord`
    MODIFY `contractAddress` VARCHAR(191) NOT NULL DEFAULT 'DATABASE_STATUS_ONLY',
    MODIFY `contractNetwork` VARCHAR(191) NOT NULL DEFAULT 'Database demo only - no real funds',
    MODIFY `buyerAddress` VARCHAR(191) NOT NULL DEFAULT 'NOT_ON_CHAIN',
    MODIFY `sellerAddress` VARCHAR(191) NOT NULL DEFAULT 'NOT_ON_CHAIN',
    MODIFY `arbiterAddress` VARCHAR(191) NOT NULL DEFAULT 'NOT_ON_CHAIN';
