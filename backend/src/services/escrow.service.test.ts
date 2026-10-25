import { describe, expect, it } from 'vitest';
import {
  ESCROW_CONTRACT_METADATA,
  generateEvmTxHash,
  generateWalletAddress
} from './escrow.service.js';

describe('Bakong Smart Contract Escrow Service', () => {
  it('generates valid EVM formatted transaction hashes', () => {
    const hash = generateEvmTxHash('lock', 'MM-TEST-123');
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/i);
  });

  it('generates deterministic EVM wallet addresses', () => {
    const address1 = generateWalletAddress('buyer-012345678');
    const address2 = generateWalletAddress('buyer-012345678');
    const address3 = generateWalletAddress('buyer-987654321');

    expect(address1).toMatch(/^0x[a-f0-9]{40}$/i);
    expect(address1).toBe(address2);
    expect(address1).not.toBe(address3);
  });

  it('exposes correct smart contract metadata', () => {
    expect(ESCROW_CONTRACT_METADATA.contractName).toBe('BakongEscrow');
    expect(ESCROW_CONTRACT_METADATA.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(ESCROW_CONTRACT_METADATA.chainId).toBe(855);
    expect(ESCROW_CONTRACT_METADATA.arbiterAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});
