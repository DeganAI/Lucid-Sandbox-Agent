/**
 * x402 Payment Middleware for Express
 * 
 * Automatically handles x402 payment flow:
 * 1. Intercepts requests to protected endpoints
 * 2. Returns 402 if no payment provided
 * 3. Verifies payment if provided
 * 4. Allows request to continue if payment valid
 */

import type { Request, Response, NextFunction } from 'express';
import { x402Manager } from '../lib/x402-payment.js';
import { CONFIG } from '../lib/config.js';

/**
 * Extended Request with x402 payment data
 */
export interface X402Request extends Request {
  x402Payment?: {
    verified: boolean;
    amount: number;
    transactionHash?: string;
    payer?: string;
  };
}

/**
 * x402 Payment Middleware Configuration
 */
export interface X402MiddlewareConfig {
  amount: number; // Required payment amount in USDC
  description: string; // Human-readable description
}

/**
 * Create x402 payment middleware
 * 
 * Usage:
 * ```
 * app.post('/api/execute', 
 *   requirePayment({ amount: 0.02, description: 'Code execution' }),
 *   executeHandler
 * );
 * ```
 * 
 * @param config - Middleware configuration
 */
export function requirePayment(config: X402MiddlewareConfig) {
  return async (req: X402Request, res: Response, next: NextFunction) => {
    try {
      // 1. Check for X-PAYMENT header
      const paymentHeader = req.headers['x-payment'] as string | undefined;

      if (!paymentHeader) {
        // No payment provided - return 402 Payment Required
        const paymentRequirement = x402Manager.createPaymentRequirement(
          config.amount,
          req.path,
          config.description
        );

        // Set x402 response headers
        res.setHeader('X-Payment-Required', config.amount.toString());
        res.setHeader('X-Payment-Token', 'USDC');
        res.setHeader('X-Payment-Address', CONFIG.wallets.base);
        res.setHeader('X-Payment-Network', CONFIG.network.name);

        return res.status(402).json({
          error: 'Payment Required',
          message: config.description,
          paymentRequirement,
        });
      }

      // 2. Parse payment payload
      const paymentPayload = x402Manager.parsePaymentHeader(paymentHeader);

      if (!paymentPayload) {
        return res.status(400).json({
          error: 'Invalid Payment',
          message: 'Could not parse X-PAYMENT header',
        });
      }

      // 3. Verify payment
      const verification = await x402Manager.verifyPayment(
        paymentPayload,
        config.amount
      );

      if (!verification.valid) {
        return res.status(402).json({
          error: 'Payment Verification Failed',
          message: verification.error || 'Payment could not be verified',
        });
      }

      // 4. Payment verified! Attach to request and continue
      req.x402Payment = {
        verified: true,
        amount: config.amount,
        transactionHash: verification.transactionHash,
        payer: paymentPayload.from,
      };

      // Set payment confirmation header
      if (verification.transactionHash) {
        res.setHeader('X-Payment-Response', JSON.stringify({
          transactionHash: verification.transactionHash,
          network: CONFIG.network.name,
          amount: config.amount,
        }));
      }

      // Continue to endpoint handler
      next();

    } catch (error) {
      console.error('x402 middleware error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Payment processing failed',
      });
    }
  };
}

/**
 * Optional payment middleware
 * 
 * Allows requests through even without payment,
 * but verifies payment if provided
 * 
 * Useful for endpoints with both free and paid tiers
 */
export function optionalPayment(config: X402MiddlewareConfig) {
  return async (req: X402Request, res: Response, next: NextFunction) => {
    try {
      const paymentHeader = req.headers['x-payment'] as string | undefined;

      if (!paymentHeader) {
        // No payment - continue but mark as unpaid
        req.x402Payment = {
          verified: false,
          amount: 0,
        };
        return next();
      }

      // Payment provided - verify it
      const paymentPayload = x402Manager.parsePaymentHeader(paymentHeader);

      if (paymentPayload) {
        const verification = await x402Manager.verifyPayment(
          paymentPayload,
          config.amount
        );

        if (verification.valid) {
          req.x402Payment = {
            verified: true,
            amount: config.amount,
            transactionHash: verification.transactionHash,
            payer: paymentPayload.from,
          };
        } else {
          req.x402Payment = {
            verified: false,
            amount: 0,
          };
        }
      }

      next();
    } catch (error) {
      console.error('Optional payment middleware error:', error);
      // Don't fail the request - just mark as unpaid
      req.x402Payment = {
        verified: false,
        amount: 0,
      };
      next();
    }
  };
}
