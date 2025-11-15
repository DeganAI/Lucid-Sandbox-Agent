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

/**
 * x402 Payment Requirement Response
 * Sent when a resource requires payment (HTTP 402)
 */
export interface PaymentRequirement {
  maxAmountRequired: string; // Amount in token's smallest unit (e.g., "10000" for 0.01 USDC)
  resource: string; // The endpoint being accessed
  description: string; // Human-readable description
  payTo: Address; // Recipient wallet address
  asset: Address; // Token contract address (USDC on Base)
  network: string; // Blockchain network (e.g., "base")
  scheme: string; // Payment scheme (e.g., "eip3009")
}

/**
 * x402 Payment Payload (sent in X-PAYMENT header)
 * Contains authorization for token transfer
 */
export interface PaymentPayload {
  scheme: string; // "eip3009" for USDC transfers
  signature: string; // Signed authorization
  from: Address; // Payer address
  to: Address; // Recipient address
  value: string; // Amount in smallest unit
  validAfter: string; // Unix timestamp
  validBefore: string; // Unix timestamp
  nonce: string; // Unique identifier
}

/**
 * Facilitator Verification Response
 */
export interface VerificationResponse {
  valid: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * x402 Payment Manager
 * Handles all x402 protocol operations
 */
export class X402PaymentManager {
  private publicClient;

  constructor() {
    // Initialize viem client for Base network
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(CONFIG.network.rpcUrl),
    });
  }

  /**
   * Create Payment Requirement Response
   * 
   * Returns the structured response for HTTP 402 status
   * Client uses this to construct payment authorization
   * 
   * @param amount - Amount in USDC (e.g., 0.02)
   * @param resource - Endpoint path
   * @param description - Human-readable description
   */
  createPaymentRequirement(
    amount: number,
    resource: string,
    description: string
  ): PaymentRequirement {
    // Convert USDC amount to smallest unit (6 decimals)
    // Example: 0.02 USDC = 20000 (0.02 * 10^6)
    const amountInSmallestUnit = Math.floor(amount * 1_000_000).toString();

    return {
      maxAmountRequired: amountInSmallestUnit,
      resource,
      description,
      payTo: CONFIG.wallets.base as Address,
      asset: CONFIG.network.usdcAddress as Address,
      network: CONFIG.network.name,
      scheme: 'eip3009', // EIP-3009: Transfer With Authorization
    };
  }

  /**
   * Verify Payment Payload
   * 
   * Validates the payment authorization sent by client
   * Checks signature, amount, timestamp, and nonce
   * 
   * @param payload - Payment payload from X-PAYMENT header
   * @param requiredAmount - Expected payment amount in USDC
   */
  async verifyPayment(
    payload: PaymentPayload,
    requiredAmount: number
  ): Promise<VerificationResponse> {
    try {
      // 1. Verify payment scheme
      if (payload.scheme !== 'eip3009') {
        return { valid: false, error: 'Unsupported payment scheme' };
      }

      // 2. Verify recipient address
      if (payload.to.toLowerCase() !== CONFIG.wallets.base.toLowerCase()) {
        return { valid: false, error: 'Invalid recipient address' };
      }

      // 3. Verify payment amount
      const requiredAmountSmallest = Math.floor(requiredAmount * 1_000_000);
      const paidAmount = parseInt(payload.value);
      
      if (paidAmount < requiredAmountSmallest) {
        return { 
          valid: false, 
          error: `Insufficient payment: ${paidAmount} < ${requiredAmountSmallest}` 
        };
      }

      // 4. Verify timestamp validity
      const now = Math.floor(Date.now() / 1000);
      const validAfter = parseInt(payload.validAfter);
      const validBefore = parseInt(payload.validBefore);

      if (now < validAfter || now > validBefore) {
        return { valid: false, error: 'Payment authorization expired' };
      }

      // 5. Call x402 facilitator for signature verification and settlement
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

  /**
   * Verify with x402 Facilitator
   * 
   * Sends payment payload to Daydreams/Coinbase facilitator
   * Facilitator verifies signature and submits transaction on-chain
   * 
   * @param payload - Payment authorization
   */
  private async verifyWithFacilitator(
    payload: PaymentPayload
  ): Promise<VerificationResponse> {
    try {
      // In production, this calls the actual facilitator API
      // Example: POST https://facilitator.x402.org/verify
      
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
        // Facilitator returned error
        const error = await response.json().catch(() => ({ error: 'Unknown facilitator error' }));
        return { 
  valid: false, 
  error: error instanceof Error ? error.message : 'Unknown error' 
};

      const result = await response.json();
      
      // Successful verification and settlement
      return {
        valid: true,
        transactionHash: result.transactionHash,
      };

    } catch (error) {
      console.error('Facilitator communication error:', error);
      
      // In development/testing, simulate successful verification
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

  /**
   * Parse X-PAYMENT header
   * 
   * Extracts and validates payment payload from request header
   * 
   * @param header - Value of X-PAYMENT header
   */
  parsePaymentHeader(header: string | null): PaymentPayload | null {
    if (!header) {
      return null;
    }

    try {
      const payload = JSON.parse(header) as PaymentPayload;
      
      // Validate required fields
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

  /**
   * Get payment status from transaction hash
   * 
   * Checks if payment transaction was confirmed on-chain
   * 
   * @param txHash - Transaction hash from facilitator
   */
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

// Export singleton instance
export const x402Manager = new X402PaymentManager();
