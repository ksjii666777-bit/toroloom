/**
 * Angel One Authentication Test Script
 *
 * Run: npx ts-node --transpile-only backend/test-angel-auth.ts
 *
 * This script:
 *   1. Loads .env file from project root
 *   2. Creates an AngelBroker instance
 *   3. Attempts to authenticate
 *   4. Reports success/failure with details
 */

import path from 'path';
import dotenv from 'dotenv';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  console.log('\n🔍 Angel One Authentication Test');
  console.log('═══════════════════════════════════\n');

  // Check which env vars are set
  const clientId = process.env.ANGEL_CLIENT_ID || '';
  const apiKey = process.env.ANGEL_API_KEY || '';
  const password = process.env.ANGEL_PASSWORD || '';
  const totp = process.env.ANGEL_TOTP || '';
  const accessToken = process.env.ANGEL_ACCESS_TOKEN || '';

  console.log('📋 Configuration Check:');
  console.log(`   ANGEL_CLIENT_ID:     ${clientId ? '✅ Set (' + clientId + ')' : '❌ EMPTY'}`);
  console.log(`   ANGEL_API_KEY:       ${apiKey ? '✅ Set' : '❌ EMPTY'}`);
  console.log(`   ANGEL_PASSWORD:      ${password ? '✅ Set' : '❌ EMPTY'}`);
  console.log(`   ANGEL_TOTP:          ${totp ? '✅ Set (Base32 secret)' : '❌ EMPTY'}`);
  console.log(`   ANGEL_ACCESS_TOKEN:  ${accessToken ? '✅ Set (will use existing token)' : 'Not provided (will generate session)'}`);
  console.log(`   BROKER:              ${process.env.BROKER || 'not set'}`);
  console.log(`   DATA_SOURCE:         ${process.env.DATA_SOURCE || 'not set'}\n`);

  if (!clientId || !apiKey) {
    console.log('❌ ERROR: ANGEL_CLIENT_ID and ANGEL_API_KEY are required.');
    console.log('   Update the .env file with your Angel One credentials.\n');
    process.exit(1);
  }

  try {
    console.log('⏳ Initializing AngelBroker...');
    const { AngelBroker } = await import('./services/broker/angelBroker');
    const broker = new AngelBroker();

    console.log('⏳ Attempting authentication...\n');

    const startTime = Date.now();
    const result = await broker.authenticate({
      clientId,
      apiKey,
      password: password || undefined,
      totp: totp || undefined,
      accessToken: accessToken || undefined,
    });
    const elapsed = Date.now() - startTime;

    if (result) {
      console.log('✅✅✅ AUTHENTICATION SUCCESSFUL! ✅✅✅\n');
      console.log(`   ⏱  Time: ${elapsed}ms`);
      console.log(`   🤖 Broker: ${broker.name}`);
      console.log(`   🔗 Connected: ${broker.isConnected()}\n`);
      console.log('   🎉 Angel One SmartAPI is working correctly!');
      console.log('   Server ab Angel One se live data fetch kar sakta hai.\n');
    } else {
      console.log('❌❌❌ AUTHENTICATION FAILED ❌❌❌\n');
      console.log(`   ⏱  Time: ${elapsed}ms`);
      console.log('   Check your credentials in the .env file.\n');
    }

    process.exit(result ? 0 : 1);
  } catch (error: any) {
    console.log('❌❌❌ AUTHENTICATION ERROR ❌❌❌\n');
    console.log(`   ${error.message}\n`);

    if (error.message?.includes('smartapi-javascript')) {
      console.log('   💡 The smartapi-javascript SDK is not installed.');
      console.log('   Run: cd backend && npm install\n');
    } else if (error.message?.includes('API key') || error.message?.includes('client ID')) {
      console.log('   💡 Missing required credentials in .env file.\n');
    } else if (error.message?.includes('password')) {
      console.log('   💡 Password is required to generate a new session.\n');
    } else {
      console.log('   💡 This could be due to:');
      console.log('      - Incorrect credentials');
      console.log('      - Network connectivity issues');
      console.log('      - Angel One API being down');
      console.log('      - Invalid TOTP secret (make sure it is the Base32 key, not a 6-digit code)\n');
    }

    process.exit(1);
  }
}

main();
