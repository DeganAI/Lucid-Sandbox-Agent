import type { Response } from 'express';
import type { X402Request } from '../middleware/x402.js';
import { sandboxExecutor, type ExecutionRequest } from '../lib/sandbox.js';
import { CONFIG } from '../lib/config.js';
import { z } from 'zod';

const ExecuteRequestSchema = z.object({
  code: z.string().min(1, 'Code cannot be empty').max(10000, 'Code too large'),
  language: z.enum(['javascript', 'python']),
  tier: z.enum(['basic', 'standard', 'premium']),
  timeout: z.number().optional(),
});

export async function executeHandler(req: X402Request, res: Response) {
  try {
    const validation = ExecuteRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'Request validation failed',
        details: validation.error.issues,
      });
    }

    const { code, language, tier, timeout } = validation.data;

    if (!req.x402Payment?.verified) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Payment verification state invalid',
      });
    }

    console.log(`🔒 Executing ${language} code for ${req.x402Payment.payer} (tier: ${tier})`);
    
    const executionRequest: ExecutionRequest = {
      code,
      language,
      tier,
      timeout,
    };

    const result = await sandboxExecutor.execute(executionRequest);

    const response = {
      success: result.success,
      output: result.output,
      error: result.error,
      executionTime: result.executionTime,
      memoryUsed: result.memoryUsed,
      executionId: result.executionId,
      tier: result.tier,
      proof: result.proof,
      payment: {
        amount: req.x402Payment.amount,
        payer: req.x402Payment.payer,
        transactionHash: req.x402Payment.transactionHash,
        network: CONFIG.network.name,
        token: CONFIG.x402.paymentToken,
      },
      timestamp: Date.now(),
    };

    console.log(`✅ Execution ${result.executionId} completed in ${result.executionTime}ms`);

    res.json(response);

  } catch (error: any) {
    console.error('Execute endpoint error:', error);
    res.status(500).json({
      error: 'Execution Failed',
      message: error.message || 'An error occurred during execution',
    });
  }
}

export function executeInfoHandler(req: X402Request, res: Response) {
  const requiredAmount = CONFIG.pricing.standard;
  
  res.status(402).json({
    x402Version: 1,
    error: 'Payment Required',
    accepts: [
      {
        scheme: 'exact',
        network: 'base',
        maxAmountRequired: (requiredAmount * 1_000_000).toString(),
        resource: '/api/execute',
        description: 'Execute code in secure sandbox',
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
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether execution succeeded',
              },
              output: {
                type: 'string',
                description: 'Console output from code execution',
              },
              executionTime: {
                type: 'number',
                description: 'Time taken to execute in milliseconds',
              },
              memoryUsed: {
                type: 'number',
                description: 'Memory used in bytes',
              },
              proof: {
                type: 'string',
                description: 'Cryptographic proof of execution (SHA-256 hash)',
              },
              executionId: {
                type: 'string',
                description: 'Unique execution identifier',
              },
            },
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
