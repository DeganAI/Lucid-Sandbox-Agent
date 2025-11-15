/**
 * Execute Endpoint
 * 
 * POST /api/execute
 * Execute code in secure sandbox with x402 payment verification
 * This is the main monetized endpoint
 */

import type { Response } from 'express';
import type { X402Request } from '../middleware/x402.js';
import { sandboxExecutor, type ExecutionRequest } from '../lib/sandbox.js';
import { CONFIG } from '../lib/config.js';
import { z } from 'zod';

/**
 * Request validation schema
 */
const ExecuteRequestSchema = z.object({
  code: z.string().min(1, 'Code cannot be empty').max(10000, 'Code too large'),
  language: z.enum(['javascript', 'python']),
  tier: z.enum(['basic', 'standard', 'premium']),
  timeout: z.number().optional(),
});

/**
 * Execute handler with payment verification
 * 
 * Note: x402 payment middleware runs BEFORE this handler
 * If we reach this point, payment was already verified
 */
export async function executeHandler(req: X402Request, res: Response) {
  try {
    // 1. Validate request body
    const validation = ExecuteRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'Request validation failed',
        details: validation.error.issues,
      });
    }

    const { code, language, tier, timeout } = validation.data;

    // 2. Payment is already verified by middleware
    // Payment data is in req.x402Payment
    if (!req.x402Payment?.verified) {
      // This should not happen if middleware is properly configured
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Payment verification state invalid',
      });
    }

    // 3. Execute code in sandbox
    console.log(`🔒 Executing ${language} code for ${req.x402Payment.payer} (tier: ${tier})`);
    
    const executionRequest: ExecutionRequest = {
      code,
      language,
      tier,
      timeout,
    };

    const result = await sandboxExecutor.execute(executionRequest);

    // 4. Return execution results
    const response = {
      // Execution results
      success: result.success,
      output: result.output,
      error: result.error,
      executionTime: result.executionTime,
      memoryUsed: result.memoryUsed,
      
      // Execution metadata
      executionId: result.executionId,
      tier: result.tier,
      proof: result.proof,
      
      // Payment information
      payment: {
        amount: req.x402Payment.amount,
        payer: req.x402Payment.payer,
        transactionHash: req.x402Payment.transactionHash,
        network: CONFIG.network.name,
        token: CONFIG.x402.paymentToken,
      },

      // Timestamps
      timestamp: Date.now(),
    };

    // Log successful execution
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

/**
 * Get execution endpoint information
 * 
 * GET /api/execute
 * Returns information about the execute endpoint
 */
export function executeInfoHandler(req: X402Request, res: Response) {
  res.json({
    endpoint: '/api/execute',
    method: 'POST',
    description: 'Execute code in secure sandbox with x402 payment',
    
    pricing: CONFIG.pricing,
    
    parameters: {
      code: {
        type: 'string',
        required: true,
        description: 'Code to execute',
        maxLength: 10000,
      },
      language: {
        type: 'string',
        required: true,
        enum: ['javascript', 'python'],
        description: 'Programming language',
      },
      tier: {
        type: 'string',
        required: true,
        enum: ['basic', 'standard', 'premium'],
        description: 'Execution tier (determines timeout and memory)',
      },
      timeout: {
        type: 'number',
        required: false,
        description: 'Custom timeout in milliseconds (cannot exceed tier limit)',
      },
    },

    headers: {
      'X-PAYMENT': {
        type: 'string',
        required: true,
        description: 'x402 payment payload (JSON string)',
        example: JSON.stringify({
          scheme: 'eip3009',
          signature: '0x...',
          from: '0x...',
          to: CONFIG.wallets.base,
          value: '20000',
          validAfter: '0',
          validBefore: Math.floor(Date.now() / 1000) + 300,
          nonce: '...',
        }),
      },
    },

    example: {
      request: {
        method: 'POST',
        url: '/api/execute',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT': '<payment-payload>',
        },
        body: {
          code: 'console.log("Hello, x402!")',
          language: 'javascript',
          tier: 'standard',
        },
      },
      response: {
        success: true,
        output: 'Hello, x402!',
        executionTime: 45,
        executionId: '...',
        proof: '0x...',
        payment: {
          amount: 0.02,
          payer: '0x...',
          transactionHash: '0x...',
        },
      },
    },

    flow: [
      '1. Client sends POST request without X-PAYMENT header',
      '2. Server responds with 402 Payment Required',
      '3. Client creates payment authorization (EIP-3009)',
      '4. Client retries request with X-PAYMENT header',
      '5. Server verifies payment with x402 facilitator',
      '6. Server executes code in sandbox',
      '7. Server returns execution results',
    ],
  });
}
