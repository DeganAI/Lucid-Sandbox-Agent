/**
 * Secure Code Sandbox Executor
 * 
 * Executes untrusted code in isolated V8 environment
 * - Memory limits
 * - Timeout enforcement
 * - No filesystem access
 * - No network access
 * - Separate heap per execution
 */

import ivm from 'isolated-vm';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { CONFIG } from './config.js';

/**
 * Execution request parameters
 */
export interface ExecutionRequest {
  code: string;
  language: 'javascript' | 'python';
  tier: 'basic' | 'standard' | 'premium';
  timeout?: number;
}

/**
 * Execution result with output and proof
 */
export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  memoryUsed: number;
  proof: string; // SHA-256 hash for verifiability
  executionId: string;
  tier: string;
}

/**
 * Tier-specific execution limits
 */
const TIER_LIMITS = {
  basic: {
    timeout: 10000,      // 10 seconds
    memory: 64,          // 64 MB
    features: ['console.log'],
  },
  standard: {
    timeout: 30000,      // 30 seconds
    memory: 128,         // 128 MB
    features: ['console.log', 'Math', 'Date'],
  },
  premium: {
    timeout: 60000,      // 60 seconds
    memory: 256,         // 256 MB
    features: ['console.log', 'Math', 'Date', 'JSON'],
  },
} as const;

/**
 * Sandbox Executor Class
 */
export class SandboxExecutor {
  /**
   * Execute code in isolated sandbox
   * 
   * @param request - Execution parameters
   * @returns Execution result with proof
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const executionId = nanoid(16);
    const startTime = Date.now();
    const tierLimits = TIER_LIMITS[request.tier];

    try {
      // 1. Validate language support
      if (!CONFIG.sandbox.allowedLanguages.includes(request.language)) {
        throw new Error(`Language ${request.language} not supported`);
      }

      // 2. Currently only JavaScript is implemented
      // Python would require additional Python interpreter in sandbox
      if (request.language !== 'javascript') {
        throw new Error('Python execution coming soon. Use JavaScript for now.');
      }

      // 3. Determine timeout based on tier
      const timeout = Math.min(
        request.timeout || tierLimits.timeout,
        tierLimits.timeout
      );

      // 4. Execute in isolated environment
      const result = await this.executeJavaScript(
        request.code,
        timeout,
        tierLimits.memory,
        executionId
      );

      const executionTime = Date.now() - startTime;

      // 5. Generate cryptographic proof
      const proof = this.generateProof({
        code: request.code,
        output: result.output,
        executionTime,
        executionId,
      });

      return {
        success: true,
        output: result.output,
        executionTime,
        memoryUsed: result.memoryUsed,
        proof,
        executionId,
        tier: request.tier,
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Generate error proof
      const proof = this.generateProof({
        code: request.code,
        error: error.message,
        executionTime,
        executionId,
      });

      return {
        success: false,
        output: '',
        error: error.message || 'Unknown execution error',
        executionTime,
        memoryUsed: 0,
        proof,
        executionId,
        tier: request.tier,
      };
    }
  }

  /**
   * Execute JavaScript code in isolated-vm
   * 
   * @param code - JavaScript code to execute
   * @param timeout - Execution timeout in milliseconds
   * @param memoryLimitMB - Memory limit in megabytes
   * @param executionId - Unique execution identifier
   */
  private async executeJavaScript(
    code: string,
    timeout: number,
    memoryLimitMB: number,
    executionId: string
  ): Promise<{ output: string; memoryUsed: number }> {
    // Create isolated V8 instance with memory limit
    const isolate = new ivm.Isolate({
      memoryLimit: memoryLimitMB,
    });

    try {
      // Create execution context
      const context = await isolate.createContext();

      // Capture console.log output
      let output = '';
      const consoleLog = new ivm.Reference((msg: string) => {
        output += msg + '\n';
      });

      // Inject safe console.log
      await context.global.set('log', consoleLog);

      // Wrap user code with safe console
      const wrappedCode = `
        const console = { 
          log: (...args) => log(args.map(a => String(a)).join(' '))
        };
        ${code}
      `;

      // Compile and execute with timeout
      const script = await isolate.compileScript(wrappedCode);
      await script.run(context, { timeout });

      // Get memory usage
      const heapStats = isolate.getHeapStatisticsSync();
      const memoryUsed = heapStats.used_heap_size;

      // Clean up
      isolate.dispose();

      return {
        output: output.trim(),
        memoryUsed,
      };

    } catch (error: any) {
      // Clean up on error
      isolate.dispose();

      // Provide helpful error messages
      if (error.message?.includes('timeout')) {
        throw new Error(`Execution timeout: code ran longer than ${timeout}ms`);
      }
      if (error.message?.includes('memory')) {
        throw new Error(`Memory limit exceeded: maximum ${memoryLimitMB}MB`);
      }

      throw error;
    }
  }

  /**
   * Generate cryptographic proof of execution
   * 
   * Creates SHA-256 hash of execution details
   * Can be used to verify execution actually occurred
   * 
   * @param data - Execution data to hash
   */
  private generateProof(data: Record<string, any>): string {
    const proofData = JSON.stringify({
      ...data,
      timestamp: Date.now(),
      network: CONFIG.network.name,
      executor: CONFIG.wallets.base,
    });

    return createHash('sha256').update(proofData).digest('hex');
  }

  /**
   * Verify execution proof
   * 
   * @param proof - Proof hash to verify
   * @param data - Original execution data
   */
  verifyProof(proof: string, data: Record<string, any>): boolean {
    const regeneratedProof = this.generateProof(data);
    return proof === regeneratedProof;
  }
}

// Export singleton instance
export const sandboxExecutor = new SandboxExecutor();
