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
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lucid Sandbox Agent - x402 Code Execution</title>
  
  <!-- Open Graph tags for x402scan -->
  <meta property="og:title" content="Lucid Sandbox Agent">
  <meta property="og:description" content="Secure JavaScript code execution with x402 micropayments on Base L2">
  <meta property="og:image" content="https://lucid-sandbox-agent-production.up.railway.app/og-image.png">
  
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  
  <style>
    body {
      font-family: 'Courier New', monospace;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      background: #0a0e27;
      color: #00ff9f;
    }
    .container {
      background: rgba(16, 20, 43, 0.95);
      border: 2px solid #00ff9f;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 0 40px rgba(0, 255, 159, 0.3);
    }
    .llama {
      font-size: 12px;
      color: #00d4ff;
      text-shadow: 0 0 10px #00d4ff;
      white-space: pre;
      margin: 20px 0;
      text-align: center;
    }
    h1 { 
      margin-top: 0; 
      font-size: 2.5em;
      color: #00ff9f;
      text-shadow: 0 0 20px #00ff9f;
    }
    h2 { 
      margin-top: 30px;
      color: #00d4ff;
      text-shadow: 0 0 10px #00d4ff;
    }
    code {
      background: rgba(0, 255, 159, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: monospace;
      color: #00ff9f;
      border: 1px solid rgba(0, 255, 159, 0.3);
    }
    pre {
      background: rgba(0, 0, 0, 0.3);
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      border: 1px solid rgba(0, 255, 159, 0.2);
    }
    .endpoint {
      background: rgba(0, 212, 255, 0.1);
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
      border-left: 4px solid #00d4ff;
    }
    .invoke-box {
      background: rgba(138, 43, 226, 0.1);
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border: 2px solid #8a2be2;
    }
    a { 
      color: #00d4ff; 
      text-decoration: none;
      text-shadow: 0 0 5px #00d4ff;
    }
    a:hover { text-decoration: underline; }
    ul { line-height: 1.8; }
    .glow { text-shadow: 0 0 10px #00ff9f; }
    .price { color: #ffd700; text-shadow: 0 0 10px #ffd700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="llama">
    ██╗     ██╗   ██╗ ██████╗██╗██████╗ 
    ██║     ██║   ██║██╔════╝██║██╔══██╗
    ██║     ██║   ██║██║     ██║██║  ██║
    ██║     ██║   ██║██║     ██║██║  ██║
    ███████╗╚██████╔╝╚██████╗██║██████╔╝
    ╚══════╝ ╚═════╝  ╚═════╝╚═╝╚═════╝ 
    </div>
    
    <h1 class="glow">🦙 LUCID SANDBOX AGENT</h1>
    <p><strong>Secure JavaScript code execution with x402 micropayments</strong></p>
    
    <h2>⚡ Features</h2>
    <ul>
      <li>💰 Pay-per-execution with USDC on Base L2</li>
      <li>🔐 Isolated sandbox with memory & timeout limits</li>
      <li>⚡ Three pricing tiers: $0.01, $0.02, $0.05</li>
      <li>🔗 x402 protocol integration</li>
      <li>📊 Cryptographic execution proofs</li>
      <li>🤖 AI agent compatible</li>
    </ul>

    <h2>🎯 Invoke Endpoint</h2>
    <div class="invoke-box">
      <p><strong>POST</strong> <code>https://lucid-sandbox-agent-production.up.railway.app/api/execute</code></p>
      <p><strong>Request Body:</strong></p>
      <pre><code>{
  "code": "console.log('Hello from Lucid!')",
  "language": "javascript",
  "tier": "standard"
}</code></pre>
      <p><strong>Headers:</strong> <code>X-PAYMENT: [payment_signature]</code></p>
    </div>

    <h2>💎 API Endpoints</h2>
    <div class="endpoint">
      <strong>Execute Code (Paid)</strong><br>
      <code>POST /api/execute</code>
      <p>Requires x402 payment in request header</p>
    </div>
    
    <div class="endpoint">
      <strong>Payment Info</strong><br>
      <code>GET /api/execute</code>
      <p>Returns 402 with payment requirements</p>
    </div>

    <div class="endpoint">
      <strong>Status Check (Free)</strong><br>
      <code>GET /api/status</code>
      <p>Health check endpoint</p>
    </div>
    
    <h2>💳 Payment Details</h2>
    <p>Address: <code>0x11c24Fbcd702cd611729F8402d8fB51ECa75Ba83</code></p>
    <p>Network: <code>Base L2 (Chain ID: 8453)</code></p>
    <p>Token: <code>USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)</code></p>
    
    <h2 class="price">💵 Pricing Tiers</h2>
    <ul>
      <li><strong class="price">Basic:</strong> $0.01 USDC (10s timeout, 64MB)</li>
      <li><strong class="price">Standard:</strong> $0.02 USDC (30s timeout, 128MB)</li>
      <li><strong class="price">Premium:</strong> $0.05 USDC (60s timeout, 256MB)</li>
    </ul>
    
    <p style="margin-top: 40px; opacity: 0.7; text-align: center;">
      🌟 Powered by Daydreams Lucid Agents & x402 Protocol 🌟<br>
      <a href="https://x402scan.com" target="_blank">View on x402scan</a>
    </p>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/favicon.ico', (req, res) => {
  // Simple 16x16 purple pixel favicon
  const favicon = Buffer.from(
    'AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
    'base64'
  );
  res.setHeader('Content-Type', 'image/x-icon');
  res.send(favicon);
});

app.get('/og-image.png', (req, res) => {
  // Simple 1200x630 purple gradient PNG for Open Graph
  const ogImage = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
    'base64'
  );
  res.setHeader('Content-Type', 'image/png');
  res.send(ogImage);
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
