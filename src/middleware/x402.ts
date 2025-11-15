import type { Request, Response, NextFunction } from 'express';
import { x402Manager } from '../lib/x402-payments.js';
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
      // Only handle POST requests - let GET requests pass through
      if (req.method !== 'POST') {
        return next();
      }

      const paymentHeader = req.headers['x-payment'] as string | undefined;

      if (!paymentHeader) {
        return res.status(402).json({
          x402Version: 1,
          error: 'Payment Required',
          accepts: [
            {
              scheme: 'exact',
              network: 'base',
              maxAmountRequired: (config.amount * 1_000_000).toString(),
              resource: req.path,
              description: config.description,
              mimeType: 'application/json',
              payTo: CONFIG.wallets.base,
              maxTimeoutSeconds: 60,
              asset: CONFIG.network.usdcAddress,
              outputSchema: {
                input: {
                  type: 'http',
                  method: 'POST',
                  bodyType: 'json',
                  bodyFields: {
                    code: {
                      type: 'string',
                      required: true,
                      description: 'JavaScript code to execute',
                    },
                    language: {
                      type: 'string',
                      required: true,
                      description: 'Programming language',
                      enum: ['javascript', 'python'],
                    },
                    tier: {
                      type: 'string',
                      required: true,
                      description: 'Execution tier',
                      enum: ['basic', 'standard', 'premium'],
                    },
                    timeout: {
                      type: 'number',
                      required: false,
                      description: 'Optional timeout in milliseconds',
                    },
                  },
                },
                output: {
                  success: 'boolean',
                  output: 'string',
                  executionTime: 'number',
                  proof: 'string',
                },
              },
              extra: {
                pricing: {
                  basic: 0.01,
                  standard: 0.02,
                  premium: 0.05,
                },
                wallets: {
                  base: CONFIG.wallets.base,
                  ethereum: CONFIG.wallets.ethereum,
                  solana: CONFIG.wallets.solana,
                },
              },
            },
          ],
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
