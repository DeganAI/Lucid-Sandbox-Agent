/**
 * x402 Payment Protocol Implementation
 * 
 * Handles the complete x402 payment flow:
 * 1. Payment requirement response (402 status)
 * 2. Payment payload verification
 * 3. Facilitator integration
 * 4. Settlement confirmation
 * 
 * Based on Coinbase x402 specification
 */

import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';
import { CONFIG } from './config.js';

export interface PaymentRequirement {
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: Address;
  asset: Address;
  network: string;
  scheme: string;
}

export interface PaymentPayload {
  scheme: string;
  signature: string;
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

export interface VerificationResponse {
  valid: boolean;
  transactionHash?: string;
  error?: string;
}

export class X402PaymentManager {
  private publicClient;

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(CONFIG.network.rpcUrl),
    });
  }

  createPaymentRequirement(
    amount: number,
    resource: string,
    description: string
  ): PaymentRequirement {
    const amountInSmallestUnit = Math.floor(amount * 1_000_000).toString();

    return {
      maxAmountRequired: amountInSmallestUnit,
      resource,
      description,
      payTo: CONFIG.wallets.base as Address,
      asset: CONFIG.network.usdcAddress as Address,
      network: CONFIG.network.name,
      scheme: 'eip3009',
    };
  }

  async verifyPayment(
    payload: PaymentPayload,
    requiredAmount: number
  ): Promise<VerificationResponse> {
    try {
      if (payload.scheme !== 'eip3009') {
        return { valid: false, error: 'Unsupported payment scheme' };
      }

      if (payload.to.toLowerCase() !== CONFIG.wallets.base.toLowerCase()) {
        return { valid: false, error: 'Invalid recipient address' };
      }

      const requiredAmountSmallest = Math.floor(requiredAmount * 1_000_000);
      const paidAmount = parseInt(payload.value);
      
      if (paidAmount < requiredAmountSmallest) {
        return { 
          valid: false, 
          error: `Insufficient payment: ${paidAmount} < ${requiredAmountSmallest}` 
        };
      }

      const now = Math.floor(Date.now() / 1000);
      const validAfter = parseInt(payload.validAfter);
      const validBefore = parseInt(payload.validBefore);

      if (now < validAfter || now > validBefore) {
        return { valid: false, error: 'Payment authorization expired' };
      }

      const verified = await this.verifyWithFacilitator(payload);
      
      return verified;

    } catch (error) {
      console.error('Payment verification error:', error);
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async verifyWithFacilitator(
    payload: PaymentPayload
  ): Promise<VerificationResponse> {
    try {
      const response = await fetch(`${CONFIG.x402.facilitatorUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment: payload,
          network: CONFIG.network.name,
          asset: CONFIG.network.usdcAddress,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown facilitator error' }));
        return { valid: false, error: (error as any).error || 'Facilitator verification failed' };
      }

      const result = await response.json();
      
      return {
        valid: true,
        transactionHash: (result as any).transactionHash,
      };

    } catch (error) {
      console.error('Facilitator communication error:', error);
      
      if (CONFIG.server.nodeEnv === 'development') {
        console.log('⚠️ Development mode: Simulating payment verification');
        return {
          valid: true,
          transactionHash: `0x${payload.nonce.padEnd(64, '0')}`,
        };
      }
      
      return { 
        valid: false, 
        error: 'Failed to communicate with payment facilitator' 
      };
    }
  }

  parsePaymentHeader(header: string | null): PaymentPayload | null {
    if (!header) {
      return null;
    }

    try {
      const payload = JSON.parse(header) as PaymentPayload;
      
      if (
        !payload.scheme ||
        !payload.signature ||
        !payload.from ||
        !payload.to ||
        !payload.value ||
        !payload.validAfter ||
        !payload.validBefore ||
        !payload.nonce
      ) {
        throw new Error('Missing required payment fields');
      }

      return payload;
    } catch (error) {
      console.error('Payment header parsing error:', error);
      return null;
    }
  }

  async getPaymentStatus(txHash: string): Promise<{
    confirmed: boolean;
    blockNumber?: bigint;
  }> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: txHash as Address,
      });

      return {
        confirmed: receipt.status === 'success',
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error('Error checking payment status:', error);
      return { confirmed: false };
    }
  }
}

export const x402Manager = new X402PaymentManager();
