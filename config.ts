/**
 * Configuration Management for Lucid Sandbox Agent
 * 
 * Centralized configuration for:
 * - Wallet addresses (Base, ETH, Solana)
 * - Network settings
 * - x402 payment protocol
 * - Sandbox security limits
 * - Pricing tiers
 */

import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Agent wallet addresses across different networks
 */
export const WALLET_ADDRESSES = {
  base: process.env.AGENT_WALLET_ADDRESS_BASE || '0x11c24Fbcd702cd611729F8402d8fB51ECa75Ba83',
  ethereum: process.env.AGENT_WALLET_ADDRESS_ETH || '0x11c24Fbcd702cd611729F8402d8fB51ECa75Ba83',
  solana: process.env.AGENT_WALLET_ADDRESS_SOLANA || '2x4BRUreTFZCaCKbGKVXFYD5p2ZUBpYaYjuYsw9KYhf3',
} as const;

/**
 * Base Network configuration for x402 payments
 */
export const BASE_NETWORK = {
  name: 'base' as const,
  chainId: parseInt(process.env.BASE_CHAIN_ID || '8453'),
  rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  usdcAddress: process.env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
} as const;

/**
 * x402 Protocol configuration
 */
export const X402_CONFIG = {
  facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://facilitator.x402.org',
  facilitatorName: process.env.FACILITATOR_NAME || 'Daydreams',
  paymentToken: process.env.PAYMENT_TOKEN || 'USDC',
  network: process.env.NETWORK || 'base',
  // x402 payment verification timeout (5 minutes)
  paymentTimeout: 300000,
} as const;

/**
 * Pricing tiers in USDC
 * These align with x402 micropayment standards ($0.01-$0.05)
 */
export const PRICING = {
  basic: parseFloat(process.env.BASIC_EXECUTION_PRICE || '0.01'),
  standard: parseFloat(process.env.STANDARD_EXECUTION_PRICE || '0.02'),
  premium: parseFloat(process.env.PREMIUM_EXECUTION_PRICE || '0.05'),
} as const;

/**
 * Sandbox security limits
 * Prevents resource exhaustion and ensures fair usage
 */
export const SANDBOX_LIMITS = {
  maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME_MS || '30000'), // 30 seconds
  maxMemory: parseInt(process.env.MAX_MEMORY_MB || '128') * 1024 * 1024, // 128MB in bytes
  allowedLanguages: (process.env.ALLOWED_LANGUAGES || 'javascript,python').split(','),
} as const;

/**
 * Server configuration
 */
export const SERVER_CONFIG = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;

/**
 * AI Model configuration for Lucid Agents
 */
export const AI_CONFIG = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  modelName: process.env.MODEL_NAME || 'gpt-4-turbo-preview',
} as const;

/**
 * Agent metadata
 */
export const AGENT_METADATA = {
  name: process.env.AGENT_NAME || 'Lucid Sandbox Executor',
  description: process.env.AGENT_DESCRIPTION || 'Secure code execution with x402 micropayments',
  version: '1.0.0',
} as const;

/**
 * Complete agent configuration export
 */
export const CONFIG = {
  wallets: WALLET_ADDRESSES,
  network: BASE_NETWORK,
  x402: X402_CONFIG,
  pricing: PRICING,
  sandbox: SANDBOX_LIMITS,
  server: SERVER_CONFIG,
  ai: AI_CONFIG,
  agent: AGENT_METADATA,
} as const;

export default CONFIG;
