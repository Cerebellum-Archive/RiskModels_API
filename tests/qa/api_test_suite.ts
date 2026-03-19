
import { writeFileSync } from 'fs';

const BASE_URL = 'https://riskmodels.net/api';
// Using a dummy key that follows the format for testing
const DUMMY_KEY = 'rm_agent_test_qa_suite_checksum';
const MAG7_TICKER = 'NVDA';
const OUT_OF_UNIVERSE_TICKER = 'JULES_ERROR';

async function log(message: string) {
  const msg = `[${new Date().toISOString()}] ${message}`;
  console.log(msg);
  try {
    writeFileSync('tests/qa/test_results.log', msg + '\n', { flag: 'a' });
  } catch (e) {
    // ignore
  }
}

async function safeFetch(url: string, init?: RequestInit) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeout);
        return res;
    } catch (e: any) {
        await log(`Fetch error for ${url}: ${e.message}`);
        return null;
    }
}

async function runTests() {
  writeFileSync('tests/qa/test_results.log', '--- RISKMODELS API QA SUITE START ---\n');

  // --- 1. Authentication & Security Scan ---
  await log('--- 1. Authentication & Security Scan ---');

  // Bearer: Missing
  const resMissing = await safeFetch(`${BASE_URL}/metrics/${MAG7_TICKER}`);
  if (resMissing) {
    await log(`Bearer Missing: Status ${resMissing.status} (Expected 401)`);
    if (resMissing.status === 200) {
        await log(`CRITICAL BUG: Endpoint /metrics/${MAG7_TICKER} accessible without Bearer token!`);
    }
  }

  // Bearer: Malformed
  const resMalformed = await safeFetch(`${BASE_URL}/metrics/${MAG7_TICKER}`, {
    headers: { 'Authorization': 'Bearer malformed_token' }
  });
  if (resMalformed) {
    await log(`Bearer Malformed: Status ${resMalformed.status} (Expected 401)`);
  }

  // Bearer: Valid Format but Unknown
  const resUnknown = await safeFetch(`${BASE_URL}/metrics/${MAG7_TICKER}`, {
    headers: { 'Authorization': `Bearer ${DUMMY_KEY}` }
  });
  if (resUnknown) {
    await log(`Bearer Unknown: Status ${resUnknown.status} (Expected 401)`);
  }

  // OAuth2 Token Flow
  const resAuthToken = await safeFetch(`${BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: 'rm_agent_test_abc123',
      client_secret: 'rm_agent_test_abc123_xyz789_checksum'
    })
  });
  if (resAuthToken) {
    await log(`OAuth2 /auth/token: Status ${resAuthToken.status}`);
    const body = await resAuthToken.json();
    await log(`OAuth2 /auth/token Response: ${JSON.stringify(body)}`);
  }

  // BOLA Check
  const resBola = await safeFetch(`${BASE_URL}/metrics/${OUT_OF_UNIVERSE_TICKER}`, {
    headers: { 'Authorization': `Bearer ${DUMMY_KEY}` }
  });
  if (resBola) {
    await log(`BOLA Check (${OUT_OF_UNIVERSE_TICKER}): Status ${resBola.status} (Expected 404 or 401)`);
  }

  // --- 2. Functional Happy Path ---
  await log('--- 2. Functional Happy Path ---');

  // GET /api/metrics/{ticker}
  const resMetrics = await safeFetch(`${BASE_URL}/metrics/${MAG7_TICKER}`, {
    headers: { 'Authorization': `Bearer ${DUMMY_KEY}` }
  });
  if (resMetrics && resMetrics.status === 200) {
    const data = await resMetrics.json();
    await log(`Metrics ${MAG7_TICKER} Response: ${JSON.stringify(data).substring(0, 200)}...`);
    // Logic Check: ER sum
    const m = data.metrics || data;
    const erFields = ['l3_market_er', 'l3_sector_er', 'l3_subsector_er', 'l3_residual_er'];
    const erSum = erFields.reduce((sum, f) => sum + (m[f] || 0), 0);
    await log(`ER Sum Logic: ${erSum.toFixed(4)} (Expected ~1.0)`);
    if (Math.abs(erSum - 1.0) > 0.05) {
        if (erSum === 0) {
            await log(`HIGH BUG: ER fields are all null/zero for ${MAG7_TICKER}`);
        } else {
            await log(`HIGH BUG: ER Sum deviation > 0.05! Actual: ${erSum}`);
        }
    }

    // Schema Check (Partial)
    const expectedFields = ['l1_mkt_hr', 'l1_mkt_er', 'l2_mkt_hr', 'l2_sec_hr', 'l3_mkt_hr', 'l3_sec_hr', 'l3_sub_hr'];
    const missing = expectedFields.filter(f => !(f in m) && !(f.replace('mkt','market').replace('sec','sector').replace('sub','subsector') in m));
    if (missing.length > 0) {
        await log(`SCHEMA DEVIATION: Missing fields in metrics: ${missing.join(', ')}`);
    }

    if (!data._metadata && !data.version) {
        await log(`SCHEMA DEVIATION: Missing _metadata block in response`);
    }
  } else if (resMetrics) {
    await log(`Metrics ${MAG7_TICKER}: Status ${resMetrics.status} - Skipping logic check`);
  }

  // GET /api/ticker-returns
  const resReturns = await safeFetch(`${BASE_URL}/ticker-returns?ticker=${MAG7_TICKER}&years=1`, {
    headers: { 'Authorization': `Bearer ${DUMMY_KEY}` }
  });
  if (resReturns) {
    await log(`Ticker Returns (years=1): Status ${resReturns.status}`);
    if (resReturns.status === 200) {
        const body = await resReturns.json();
        if (!body._agent) await log(`SCHEMA DEVIATION: Missing _agent block in /ticker-returns`);
    }
  }

  // POST /api/batch/analyze
  const resBatch = await safeFetch(`${BASE_URL}/batch/analyze`, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${DUMMY_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        tickers: [MAG7_TICKER, 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'],
        metrics: ['hedge_ratios']
    })
  });
  if (resBatch && resBatch.status === 200) {
    const data = await resBatch.json();
    const cost = data._agent?.cost_usd;
    await log(`Batch Analyze: 200 OK, cost_usd: ${cost}`);
    if (cost === undefined) await log(`SCHEMA DEVIATION: Missing _agent.cost_usd in /batch/analyze`);
  } else if (resBatch) {
    await log(`Batch Analyze: Status ${resBatch.status}`);
  }

  // --- 3. Boundary & Edge Case Hunting ---
  await log('--- 3. Boundary & Edge Case Hunting ---');

  // Mixed Batch
  const resMixed = await safeFetch(`${BASE_URL}/batch/analyze`, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${DUMMY_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        tickers: [MAG7_TICKER, OUT_OF_UNIVERSE_TICKER],
        metrics: ['hedge_ratios']
    })
  });
  if (resMixed && resMixed.status === 200) {
    const data = await resMixed.json();
    const fakeResult = data.results?.[OUT_OF_UNIVERSE_TICKER];
    await log(`Fake Ticker Result: ${JSON.stringify(fakeResult)} (Expected status: not_found)`);
    if (fakeResult?.status !== 'not_found') {
        await log(`LOW BUG: /batch/analyze returned status '${fakeResult?.status}' for invalid ticker, expected 'not_found'`);
    }
  }

  // --- 4. Billing & Metadata Integrity ---
  await log('--- 4. Billing & Metadata Integrity ---');

  // Latency & Cache Check
  const res1 = await safeFetch(`${BASE_URL}/metrics/${MAG7_TICKER}`, {
    headers: { 'Authorization': `Bearer ${DUMMY_KEY}` }
  });
  if (res1) {
    const latencyHeader = res1.headers.get('X-Latency-MS');
    const cacheHeader = res1.headers.get('X-Cache-Status');
    const costHeader = res1.headers.get('X-API-Cost-USD');
    await log(`Headers: Cache=${cacheHeader}, Cost=${costHeader}, Latency=${latencyHeader}`);

    if (!cacheHeader) await log(`SCHEMA DEVIATION: Missing X-Cache-Status header`);
    if (!costHeader && res1.status === 200) await log(`SCHEMA DEVIATION: Missing X-API-Cost-USD header`);
  }

  await log('--- RISKMODELS API QA SUITE COMPLETE ---');
}

runTests().catch(err => {
  log(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
