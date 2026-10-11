import pool from "./config/db.js";

const API_BASE = "http://localhost:5000/api";

async function verifyPhase4() {
  console.log("=========================================");
  console.log("🔍 Lynq Phase 4: Hybrid Auth Verification");
  console.log("=========================================\n");

  try {
    // ── Check 1: PostgreSQL Schema Verification ───────────────────────────
    console.log("1️⃣  Verifying PostgreSQL schema for user_id column and index...");
    const colCheck = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'urls' AND column_name = 'user_id'`
    );
    if (colCheck.rows.length === 0) {
      throw new Error("Missing 'user_id' column on 'urls' table!");
    }
    console.log("   ✅ 'user_id' column verified in 'urls' table:", colCheck.rows[0]);

    const idxCheck = await pool.query(
      `SELECT indexname FROM pg_indexes 
       WHERE tablename = 'urls' AND indexname = 'idx_urls_user_id'`
    );
    if (idxCheck.rows.length === 0) {
      throw new Error("Missing 'idx_urls_user_id' index on 'urls' table!");
    }
    console.log("   ✅ 'idx_urls_user_id' index verified.");

    // ── Check 2: Create 2 links in Guest mode ─────────────────────────────
    console.log("\n2️⃣  Shortening 2 links in Guest Mode (unauthenticated)...");
    const testStamp = Date.now();

    const shortenCall = async (body) => {
      const res = await fetch(`${API_BASE}/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    };

    const link1 = await shortenCall({
      url: `https://example.com/guest-article-${testStamp}`,
      title: "Guest Article",
      expiresInDays: 30,
    });
    const link2 = await shortenCall({
      url: `https://github.com/lynq-project-${testStamp}`,
      title: "Guest Repo",
      expiresInDays: 30,
    });

    if (!link1.shortCode || !link1.editToken || !link2.shortCode || !link2.editToken) {
      throw new Error("Failed to shorten guest links properly!");
    }
    console.log(`   ✅ Link 1 created: ${link1.shortCode} (editToken: ${link1.editToken.substring(0, 8)}...)`);
    console.log(`   ✅ Link 2 created: ${link2.shortCode} (editToken: ${link2.editToken.substring(0, 8)}...)`);

    // Verify both have user_id IS NULL in database
    const dbRows = await pool.query(
      "SELECT short_code, user_id FROM urls WHERE short_code IN ($1, $2)",
      [link1.shortCode, link2.shortCode]
    );
    const hasNullUser = dbRows.rows.every((r) => r.user_id === null);
    if (!hasNullUser) {
      throw new Error("Guest links should have user_id = NULL in database!");
    }
    console.log("   ✅ Verified: Both guest links have NULL user_id in database.");

    // ── Check 3: Protected route 401 rejection without auth ───────────────
    console.log("\n3️⃣  Testing unauthorized access protection...");
    const unauthRes = await fetch(`${API_BASE}/user/links`);
    if (unauthRes.status === 401) {
      console.log("   ✅ Correctly rejected unauthenticated request with 401 Unauthorized.");
    } else {
      throw new Error(`Expected 401 Unauthorized for /api/user/links without auth, but got ${unauthRes.status}!`);
    }

    // ── Check 4: Claim guest links into authenticated user account ────────
    console.log("\n4️⃣  Testing POST /api/user/claim-links...");
    const testUserId = `usr_test_phase4_${testStamp}`;
    const claimRes = await fetch(`${API_BASE}/user/claim-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": testUserId,
      },
      body: JSON.stringify({
        links: [
          { shortCode: link1.shortCode, editToken: link1.editToken },
          { shortCode: link2.shortCode, editToken: link2.editToken },
          { shortCode: "fakeCode", editToken: "fakeToken" }, // should safely be ignored
        ],
      }),
    });
    const claimData = await claimRes.json();

    if (!claimData.success || claimData.claimedCount !== 2) {
      throw new Error(`Expected 2 claimed links, got ${claimData.claimedCount}`);
    }
    console.log(`   ✅ Claimed ${claimData.claimedCount} links successfully:`, claimData.claimedCodes);

    // Verify in database that user_id is now bound
    const claimedDbRows = await pool.query(
      "SELECT short_code, user_id FROM urls WHERE short_code IN ($1, $2)",
      [link1.shortCode, link2.shortCode]
    );
    const allBound = claimedDbRows.rows.every((r) => r.user_id === testUserId);
    if (!allBound) {
      throw new Error("Database user_id was not updated to authenticated user!");
    }
    console.log(`   ✅ Database verified: All links permanently bound to '${testUserId}'`);

    // ── Check 5: Fetch user links portfolio ───────────────────────────────
    console.log("\n5️⃣  Testing GET /api/user/links...");
    const userLinksRes = await fetch(`${API_BASE}/user/links`, {
      headers: { "x-test-user-id": testUserId },
    });
    const userLinksData = await userLinksRes.json();

    if (!userLinksData.success || userLinksData.links.length !== 2) {
      throw new Error(`Expected 2 user links, got ${userLinksData.links?.length}`);
    }
    console.log(`   ✅ Retrieved ${userLinksData.links.length} owned links:`);
    userLinksData.links.forEach((l) => {
      console.log(`      • ${l.shortCode} -> ${l.originalUrl} (${l.clicks} clicks)`);
    });

    // ── Check 6: Portfolio Aggregates Summary ─────────────────────────────
    console.log("\n6️⃣  Testing GET /api/user/analytics/summary...");
    // Simulate clicks on link1 and link2
    await pool.query("UPDATE urls SET clicks = 15 WHERE short_code = $1::varchar", [link1.shortCode]);
    await pool.query("UPDATE urls SET clicks = 7 WHERE short_code = $1::varchar", [link2.shortCode]);

    const summaryRes = await fetch(`${API_BASE}/user/analytics/summary`, {
      headers: { "x-test-user-id": testUserId },
    });
    const summaryData = await summaryRes.json();
    if (!summaryData.success) {
      throw new Error(`Summary API failed: ${summaryData.error || JSON.stringify(summaryData)}`);
    }
    const summary = summaryData.summary;
    console.log("   ✅ Summary aggregates received:", summary);

    if (summary.totalClicks !== 22) {
      throw new Error(`Expected 22 totalClicks, got ${summary.totalClicks}`);
    }
    if (summary.totalLinks !== 2) {
      throw new Error(`Expected 2 totalLinks, got ${summary.totalLinks}`);
    }
    if (summary.activeLinks !== 2) {
      throw new Error(`Expected 2 activeLinks, got ${summary.activeLinks}`);
    }
    if (summary.topLinks.length !== 2 || summary.topLinks[0].shortCode !== link1.shortCode) {
      throw new Error("Top link ordering is incorrect!");
    }
    console.log(`   ✅ Top performer: ${summary.topLinks[0].shortCode} with ${summary.topLinks[0].clicks} clicks.`);

    // ── Check 7: Prevent hijacking / invalid token claim ──────────────────
    console.log("\n7️⃣  Testing security: cannot claim with invalid edit token...");
    const attackerUserId = `usr_attacker_${testStamp}`;
    const hijackRes = await fetch(`${API_BASE}/user/claim-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": attackerUserId,
      },
      body: JSON.stringify({
        links: [{ shortCode: link1.shortCode, editToken: "wrong_token_here" }],
      }),
    });
    const hijackData = await hijackRes.json();

    if (hijackData.claimedCount !== 0) {
      throw new Error("Security vulnerability: Link was claimed with invalid edit token!");
    }
    console.log("   ✅ Security verified: Invalid edit token claim rejected (claimedCount: 0).");

    console.log("\n=========================================");
    console.log("🎉 ALL PHASE 4 VERIFICATION CHECKS PASSED!");
    console.log("=========================================\n");
  } catch (err) {
    console.error("❌ Verification failed:", err.stack || err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyPhase4();
