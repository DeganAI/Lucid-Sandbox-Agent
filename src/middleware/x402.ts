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

export interface X402Request extends Request {
  x402Payment?: {
    verified: boolean;
    amount: number;
    transactionHash?: string;
    payer?: string;
  };
}

export interface X402MiddlewareConfig {
  amount: number;
  description: string;
}

export function requirePayment(config: X402MiddlewareConfig) {
  return async (req: X402Request, res: Response, next: NextFunction) => {
    try {
      const paymentHeader = req.headers['x-payment'] as string | undefined;

      if (!paymentHeader) {
        const paymentRequirement = x402Manager.createPaymentRequirement(
          config.amount,
          req.path,
          config.description
        );

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

      const paymentPayload = x402Manager.parsePaymentHeader(paymentHeader);

      if (!paymentPayload) {
        return res.status(400).json({
          error: 'Invalid Payment',
          message: 'Could not parse X-PAYMENT header',
        });
      }

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

      req.x402Payment = {
        verified: true,
        amount: config.amount,
        transactionHash: verification.transactionHash,
        payer: paymentPayload.from,
      };

      if (verification.transactionHash) {
        res.setHeader('X-Payment-Response', JSON.stringify({
          transactionHash: verification.transactionHash,
          network: CONFIG.network.name,
          amount: config.amount,
        }));
      }

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

export function optionalPayment(config: X402MiddlewareConfig) {
  return async (req: X402Request, res: Response, next: NextFunction) => {
    try {
      const paymentHeader = req.headers['x-payment'] as string | undefined;

      if (!paymentHeader) {
        req.x402Payment = {
          verified: false,
          amount: 0,
        };
        return next();
      }

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
      req.x402Payment = {
        verified: false,
        amount: 0,
      };
      next();
    }
  };
}
