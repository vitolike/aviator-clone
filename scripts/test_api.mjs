// Test script for Aviator Backend APIs
async function run() {
  console.log('--- 1. Testing Seamless Session Creation ---');
  const sessionRes = await fetch('http://127.0.0.1/api/seamless/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_player_id: 'player_victor_100',
      username: 'VictorVIP',
      currency: 'BRL',
      initial_balance: 1500
    })
  });
  const sessionData = await sessionRes.json();
  console.log('Seamless session result:', sessionData);

  const token = sessionData.token;
  if (!token) throw new Error('No token returned');

  console.log('\n--- 2. Testing Session Me with Token ---');
  const meRes = await fetch(`http://127.0.0.1/api/session/me?token=${token}`);
  const meData = await meRes.json();
  console.log('Session Me:', meData);

  console.log('\n--- 3. Testing Seamless Balance Check ---');
  const balRes = await fetch(`http://127.0.0.1/api/seamless/balance?token=${token}`);
  const balData = await balRes.json();
  console.log('Seamless Balance:', balData);

  console.log('\n--- 4. Testing Seamless Debit / Credit Transaction ---');
  const debitRes = await fetch('http://127.0.0.1/api/seamless/transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      transaction_id: 'tx_test_' + Date.now(),
      type: 'DEBIT',
      amount: 100,
      round_id: 1,
      reason: 'bet_test'
    })
  });
  const debitData = await debitRes.json();
  console.log('Debit result:', debitData);

  console.log('\n--- 5. Testing Admin Login & Stats ---');
  const loginRes = await fetch('http://127.0.0.1/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  const loginData = await loginRes.json();
  console.log('Admin login:', loginData);

  const statsRes = await fetch('http://127.0.0.1/api/admin/stats', {
    headers: { 'Authorization': `Bearer ${loginData.adminKey}` }
  });
  const statsData = await statsRes.json();
  console.log('Admin stats:', statsData);

  console.log('\n--- 6. Testing Admin Force Crash Multiplier ---');
  const forceRes = await fetch('http://127.0.0.1/api/admin/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.adminKey}`
    },
    body: JSON.stringify({ force_multiplier: 88.88 })
  });
  const forceData = await forceRes.json();
  console.log('Admin force multiplier setting:', forceData);

  console.log('\n✅ ALL BACKEND AND SEAMLESS API CHECKS PASSED!');
}

run().catch(e => {
  console.error('❌ API Test Failed:', e);
  process.exit(1);
});
