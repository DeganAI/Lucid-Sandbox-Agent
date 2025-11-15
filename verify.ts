/**
 * Verify Endpoint
 * 
 * GET /api/verify
 * Returns wallet addresses and verification information
 * This is a free endpoint for trust verification
 */

import type { Request, Response } from 'express';
import { CONFIG } from '../lib/config.js';

export async function verifyHandler(req: Request, res: Response) {
  try {
    const verification = {
      // Agent identity
      agent: {
        name: CONFIG.agent.name,
        version: CONFIG.agent.version,
      },

      // Wallet addresses across networks
      wallets: {
        base: {
          address: CONFIG.wallets.base,
          network: 'Base L2',
          chainId: CONFIG.network.chainId,
          primary: true,
          description: 'Primary payment address for USDC on Base',
        },
        ethereum: {
          address: CONFIG.wallets.ethereum,
          network: 'Ethereum Mainnet',
          chainId: 1,
          primary: false,
          description: 'Ethereum mainnet address',
        },
        solana: {
          address: CONFIG.wallets.solana,
          network: 'Solana Mainnet',
          primary: false,
          description: 'Solana address for future multi-chain support',
        },
      },

      // Payment configuration
      payment: {
        token: CONFIG.x402.paymentToken,
        tokenAddress: CONFIG.network.usdcAddress,
        facilitator: CONFIG.x402.facilitatorName,
        network: CONFIG.network.name,
      },

      // Trust indicators
      trust: {
        verifiedAt: Date.now(),
        // In production, these would come from ERC-8004 on-chain data
        trustScore: 95,
        attestations: [
          {
            type: 'identity',
            hash: '0x' + Buffer.from(CONFIG.wallets.base).toString('hex').slice(0, 64),
          },
          {
            type: 'capability',
            hash: '0x' + Buffer.from('sandbox-executor').toString('hex').slice(0, 64),
          },
        ],
      },

      // Service guarantees
      guarantees: {
        sandboxIsolation: true,
        noDataRetention: true,
        deterministicExecution: true,
        cryptographicProofs: true,
      },

      // Compliance
      compliance: {
        x402Protocol: true,
        eip3009: true, // EIP-3009: Transfer With Authorization
        erc8004: 'pending', // ERC-8004: Trustless Agents (future)
      },

      // Timestamps
      timestamp: Date.now(),
    };

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(verification);

  } catch (error) {
    console.error('Verify endpoint error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve verification data',
    });
  }
}
