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
  console.log("🧪 Starting Phase 7 Verification Suite");
  console.log("==========================================\n");

  // 1. Create a link
  const testAlias = "phase7-csv-" + Math.floor(1000 + Math.random() * 9000);
  const shortenRes = await fetch(`${API}/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://example.com/developer-dx",
      customAlias: testAlias,
      title: "Developer DX Docs",
      expiresInDays: 7,
    }),
  });
  const shortenData = await shortenRes.json();
  const shortCode = shortenData.shortCode;
  assert(Boolean(shortCode), `Created test link with code: ${shortCode}`);

  // 2. Simulate clicks with different user agents and referrers
  console.log("Simulating telemetry clicks...");
  const userAgents = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
  ];

  for (let i = 0; i < userAgents.length; i++) {
    await fetch(`${API}/resolve/${shortCode}?referrer=https://twitter.com/dev`, {
      headers: {
        "User-Agent": userAgents[i],
        Referer: "https://twitter.com/dev",
      },
    });
  }

  // 3. Wait 6s for the background worker to flush analytics to click_history
  console.log("Waiting 6s for analytics worker batch flush...");
  await new Promise((r) => setTimeout(r, 6000));

  // 4. Test Analytics CSV Export Endpoint
  console.log(`Requesting CSV export for ${shortCode}...`);
  const exportRes = await fetch(`${API}/analytics/${shortCode}/export`);
  assert(exportRes.status === 200, "CSV Export returned 200 OK");

  const contentType = exportRes.headers.get("content-type") || "";
  assert(contentType.includes("text/csv"), `Content-Type is text/csv (got: ${contentType})`);

  const disposition = exportRes.headers.get("content-disposition") || "";
  assert(
    disposition.includes(`lynq-${shortCode}-analytics.csv`),
    `Content-Disposition header includes correct filename (got: ${disposition})`
  );

  const csvBody = await exportRes.text();
  const lines = csvBody.trim().split("\n");

  assert(lines.length >= 2, `CSV contains header plus at least one data row (found ${lines.length} lines)`);
  assert(
    lines[0] === "Timestamp,Country,City,Device,Browser,OS,Referrer",
    `CSV header row is correct: ${lines[0]}`
  );

  console.log("\nSample CSV content preview:");
  lines.slice(0, 4).forEach((line, idx) => {
    console.log(`  [Line ${idx + 1}] ${line}`);
  });

  // 5. Test 404 for non-existent short code export
  const fakeRes = await fetch(`${API}/analytics/non-existent-code-12345/export`);
  assert(fakeRes.status === 404, "Exporting non-existent code returned 404");

  console.log("\n==========================================");
  console.log("🎉 ALL PHASE 7 VERIFICATION CHECKS PASSED!");
  console.log("==========================================");
  process.exit(0);
};

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
