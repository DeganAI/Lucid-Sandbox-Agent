import express from 'express';
import cors from 'cors';
import { CONFIG } from './lib/config.js';
import { requirePayment } from './middleware/x402.js';
import { statusHandler } from './routes/status.js';
import { executeHandler, executeInfoHandler } from './routes/execute.js';
import { verifyHandler } from './routes/verify.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: CONFIG.agent.name,
    version: CONFIG.agent.version,
    description: CONFIG.agent.description,
    status: 'online',
    endpoints: {
      status: 'GET /api/status',
      execute: 'POST /api/execute',
      verify: 'GET /api/verify',
    },
    documentation: 'https://github.com/YOUR_USERNAME/lucid-sandbox-agent',
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

app.get('/api/status', statusHandler);
app.get('/api/verify', verifyHandler);

// GET /api/execute returns 402 with payment requirements (for x402scan)
app.get('/api/execute', executeInfoHandler);

// POST /api/execute with payment middleware
app.post(
  '/api/execute',
  requirePayment({
    amount: CONFIG.pricing.standard,
    description: 'Code execution in secure sandbox',
  }),
  executeHandler
);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} not found`,
    availableEndpoints: {
      status: 'GET /api/status',
      execute: 'POST /api/execute',
      verify: 'GET /api/verify',
    },
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

const PORT = CONFIG.server.port;

app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║           🚀 Lucid Sandbox Agent Started 🚀               ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 Configuration:');
  console.log(`   • Name: ${CONFIG.agent.name}`);
  console.log(`   • Version: ${CONFIG.agent.version}`);
  console.log(`   • Port: ${PORT}`);
  console.log(`   • Environment: ${CONFIG.server.nodeEnv}`);
  console.log();
  
  console.log('💰 Payment Configuration:');
  console.log(`   • Network: ${CONFIG.network.name} (Chain ID: ${CONFIG.network.chainId})`);
  console.log(`   • Token: ${CONFIG.x402.paymentToken}`);
  console.log(`   • Facilitator: ${CONFIG.x402.facilitatorName}`);
  console.log(`   • Wallet (Base): ${CONFIG.wallets.base}`);
  console.log(`   • Wallet (ETH): ${CONFIG.wallets.ethereum}`);
  console.log(`   • Wallet (Solana): ${CONFIG.wallets.solana}`);
  console.log();
  
  console.log('💵 Pricing:');
  console.log(`   • Basic: $${CONFIG.pricing.basic.toFixed(2)} USDC`);
  console.log(`   • Standard: $${CONFIG.pricing.standard.toFixed(2)} USDC`);
  console.log(`   • Premium: $${CONFIG.pricing.premium.toFixed(2)} USDC`);
  console.log();
  
  console.log('🔌 Endpoints:');
  console.log(`   • GET  http://localhost:${PORT}/api/status (free)`);
  console.log(`   • POST http://localhost:${PORT}/api/execute (paid)`);
  console.log(`   • GET  http://localhost:${PORT}/api/verify (free)`);
  console.log();
  
  console.log('🔐 Security:');
  console.log(`   • Sandbox: isolated-vm`);
  console.log(`   • Max Memory: ${CONFIG.sandbox.maxMemory / (1024 * 1024)}MB`);
  console.log(`   • Max Execution Time: ${CONFIG.sandbox.maxExecutionTime / 1000}s`);
  console.log(`   • Supported Languages: ${CONFIG.sandbox.allowedLanguages.join(', ')}`);
  console.log();
  
  console.log('✅ Ready to accept x402 payments and execute code!');
  console.log(`🌐 Visit http://localhost:${PORT} to get started\n`);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;
