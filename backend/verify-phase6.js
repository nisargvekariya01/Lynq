const API = "http://localhost:5000/api";

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
};

const runVerification = async () => {
  console.log("==========================================");
  console.log("🧪 Starting Phase 6 Verification Suite");
  console.log("==========================================\n");

  // ----------------------------------------------------
  // TEST 1: Security Service - Malicious TLD & Typo-squatting
  // ----------------------------------------------------
  console.log("--- 1. Testing Malicious & Typo-squat Detection ---");

  // Safe URL should succeed
  const safeRes = await fetch(`${API}/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://nodejs.org/en/docs",
      title: "Node.js Documentation",
      expiresInDays: 7,
    }),
  });
  const safeData = await safeRes.json();
  assert(safeRes.status === 201 || safeRes.status === 200, "Legitimate URL shortened successfully");

  // High-risk TLD (.zip) should be blocked
  const zipRes = await fetch(`${API}/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://account-update.zip/download",
      title: "Suspicious Zip",
      expiresInDays: 7,
    }),
  });
  const zipData = await zipRes.json();
  assert(
    zipRes.status === 403 && zipData.error?.includes(".zip"),
    `Blocked suspicious .zip TLD: ${zipData.error}`
  );

  // High-risk TLD (.top) should be blocked
  const topRes = await fetch(`${API}/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://cheap-deals.top/gift",
      title: "Top Domain",
      expiresInDays: 7,
    }),
  });
  const topData = await topRes.json();
  assert(
    topRes.status === 403 && topData.error?.includes(".top"),
    `Blocked suspicious .top TLD: ${topData.error}`
  );

  // Typo-squatted brand (paypa1) should be blocked
  const typoRes = await fetch(`${API}/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://paypa1.com/verify-account",
      title: "Fake Paypal",
      expiresInDays: 7,
    }),
  });
  const typoData = await typoRes.json();
  assert(
    typoRes.status === 403 &&
      (typoData.error?.includes("typo-squatting") || typoData.error?.includes("impersonation")),
    `Blocked typo-squat paypa1: ${typoData.error}`
  );

  // Brand spoofing combination (paypal-login-portal) should be blocked
  const spoofRes = await fetch(`${API}/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://paypal-login-portal.com/auth",
      title: "Paypal Spoof",
      expiresInDays: 7,
    }),
  });
  const spoofData = await spoofRes.json();
  assert(
    spoofRes.status === 403 && spoofData.error?.includes("domain spoofing"),
    `Blocked brand spoofing domain: ${spoofData.error}`
  );

  // Blacklisted domain should be blocked
  const blackRes = await fetch(`${API}/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://stealyourpassword.org/index.html",
      title: "Malware Site",
      expiresInDays: 7,
    }),
  });
  const blackData = await blackRes.json();
  assert(
    blackRes.status === 403,
    `Blocked blacklisted domain: ${blackData.error}`
  );

  // ----------------------------------------------------
  // TEST 2: AI TL;DR Summary & Redis Caching
  // ----------------------------------------------------
  console.log("\n--- 2. Testing AI Link Summary & Redis Caching ---");

  const testAlias = "phase6-summary-" + Math.floor(1000 + Math.random() * 9000);
  const shortenRes = await fetch(`${API}/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://en.wikipedia.org/wiki/Node.js",
      customAlias: testAlias,
      title: "Node.js Wikipedia Overview",
      expiresInDays: 7,
    }),
  });
  const shortenData = await shortenRes.json();
  const shortCode = shortenData.shortCode;
  assert(Boolean(shortCode), `Created test link with code: ${shortCode}`);

  // Fetch summary first time (fresh synthesis / Gemini)
  console.log(`Fetching AI summary for ${shortCode} (first run, should cache)...`);
  const summaryRes1 = await fetch(`${API}/ai/summary/${shortCode}`);
  const summaryData1 = await summaryRes1.json();
  assert(summaryRes1.status === 200, "AI summary endpoint returned 200 OK");
  assert(Boolean(summaryData1.summary), `Generated summary: "${summaryData1.summary}"`);
  assert(summaryData1.cached === false, "First summary fetch marked cached = false");

  // Fetch summary second time (must hit Redis cache!)
  console.log("Fetching AI summary again (should hit Redis cache)...");
  const summaryRes2 = await fetch(`${API}/ai/summary/${shortCode}`);
  const summaryData2 = await summaryRes2.json();
  assert(summaryRes2.status === 200, "Second AI summary fetch returned 200 OK");
  assert(summaryData2.summary === summaryData1.summary, "Cached summary matches original summary");
  assert(summaryData2.cached === true, "Second summary fetch correctly marked cached = true");

  // ----------------------------------------------------
  // TEST 3: Smart AI Alias Alternatives
  // ----------------------------------------------------
  console.log("\n--- 3. Testing AI Smart Alias Alternatives ---");

  // Register taken alias
  const takenAlias = "taken-phase6-" + Math.floor(1000 + Math.random() * 9000);
  await fetch(`${API}/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://github.com",
      customAlias: takenAlias,
      title: "Github Homepage",
      expiresInDays: 7,
    }),
  });

  console.log(`Registered taken alias '${takenAlias}'. Requesting alternative suggestions...`);
  const altRes = await fetch(`${API}/ai/suggest-aliases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetUrl: "https://github.com",
      desiredAlias: takenAlias,
    }),
  });
  const altData = await altRes.json();

  assert(altRes.status === 200, "Suggest aliases endpoint returned 200 OK");
  assert(Array.isArray(altData.suggestions), "Returned suggestions array");
  assert(altData.suggestions.length >= 3, `Returned ${altData.suggestions.length} suggestions`);
  assert(
    !altData.suggestions.includes(takenAlias),
    `Suggestions do not include the taken alias: [${altData.suggestions.join(", ")}]`
  );

  // Verify that the suggested alternatives are actually available!
  for (const alt of altData.suggestions) {
    const checkRes = await fetch(`${API}/check-alias/${encodeURIComponent(alt)}`);
    const checkData = await checkRes.json();
    assert(checkData.available === true, `Suggested alternative '${alt}' is verified available in DB`);
  }

  console.log("\n==========================================");
  console.log("🎉 ALL PHASE 6 VERIFICATION CHECKS PASSED!");
  console.log("==========================================");
  process.exit(0);
};

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
