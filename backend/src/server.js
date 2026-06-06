const app = require('./app');
const { config, checkEbayCredentials } = require('./config/env');

const PORT = config.port;

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n=== Frost eBay Analyzer ===');
  console.log(`Server running on port ${PORT} (bind: 0.0.0.0)`);
  console.log(`Environment: ${config.ebay.env}`);
  console.log(`Marketplace: ${config.ebay.marketplaceId}`);

  const creds = checkEbayCredentials();
  if (creds.configured) {
    console.log('eBay credentials: configured');
  } else {
    console.log(`eBay credentials: NOT configured (missing: ${creds.missing.join(', ')})`);
    console.log('  -> The server will start, but eBay-dependent endpoints will return errors.');
    console.log('  -> Set credentials in .env (see .env.example)');
  }

  console.log('\nEndpoints:');
  console.log('  GET  /health');
  console.log('  POST /analyze');
  console.log('  GET  /debug/search?q=...');
  console.log('  GET  /debug/token');
  console.log('  GET  /feed');
  console.log('');
});
