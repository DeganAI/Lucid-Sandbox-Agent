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
        // Return same 402 response as GET /api/execute
        return res.status(402).json({
          x402Version: 1,
          accepts: [
            {
              scheme: "exact",
              network: "base",
              maxAmountRequired: "20000",
              resource: "https://lucid-sandbox-agent-production.up.railway.app/api/execute",
              description: "Execute JavaScript code in secure sandbox",
              mimeType: "application/json",
              payTo: "0x11c24Fbcd702cd611729F8402d8fB51ECa75Ba83",
              maxTimeoutSeconds: 60,
              asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              outputSchema: {
                input: {
                  type: "http",
                  method: "POST",
                  bodyType: "json",
                  bodyFields: {
                    code: {
                      type: "string",
                      required: true,
                      description: "JavaScript code to execute",
                    },
                    language: {
                      type: "string",
                      required: true,
                      description: "Programming language",
                      enum: ["javascript", "python"]
                    },
                    tier: {
                      type: "string",
                      required: true,
                      description: "Execution tier",
                      enum: ["basic", "standard", "premium"]
                    }
                  }
                },
                output: {
                  type: "object",
                  properties: {
                    success: { 
                      type: "boolean",
                      description: "Execution success status"
                    },
                    output: { 
                      type: "string",
                      description: "Console output"
                    },
                    executionTime: { 
                      type: "number",
                      description: "Execution time in ms"
                    }
                  }
                }
              }
            }
          ]
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
