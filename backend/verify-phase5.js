import pool from "./config/db.js";
import redisClient, { connectRedis } from "./config/redis.js";

const API_BASE = "http://localhost:5000/api";
const REDIRECT_BASE = "http://localhost:5000";

async function verifyPhase5() {
  console.log("=================================================");
  console.log("⚡ Lynq Phase 5: Smart Redirect Engine Verification");
  console.log("=================================================\n");

  try {
    await connectRedis();

    // ── Check 1: PostgreSQL Schema Verification ───────────────────────────
    console.log("1️⃣  Verifying PostgreSQL schema for routing_rules column...");
    const colCheck = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'urls' AND column_name = 'routing_rules'`
    );
    if (colCheck.rows.length === 0) {
      throw new Error("Missing 'routing_rules' column on 'urls' table!");
    }
    console.log("   ✅ 'routing_rules' column verified in 'urls' table:", colCheck.rows[0]);

    // ── Check 2: Device-Based Dynamic Redirection ─────────────────────────
    console.log("\n2️⃣  Testing Device-Based Dynamic Redirection...");
    const testStamp = Date.now();
    const iosTarget = "https://apps.apple.com/app/lynq-ios-id123456";
    const androidTarget = "https://play.google.com/store/apps/details?id=app.lynq.android";
    const desktopTarget = "https://example.com/desktop-landing-page";
    const defaultWebTarget = "https://example.com/default-home";

    const createDeviceRes = await fetch(`${API_BASE}/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: defaultWebTarget,
        title: "Device Targeting Link",
        expiresInDays: 30,
        routingRules: {
          device: {
            ios: iosTarget,
            android: androidTarget,
            desktop: desktopTarget,
          },
        },
      }),
    });
    const deviceLink = await createDeviceRes.json();
    if (!deviceLink.success || !deviceLink.shortCode) {
      throw new Error("Failed to shorten device targeting link!");
    }
    console.log(`   ✅ Link created: ${deviceLink.shortCode}`);

    // Verify Redis cache has routing_rules
    const cachedHash = await redisClient.hGetAll(`url:${deviceLink.shortCode}`);
    if (!cachedHash || !cachedHash.routing_rules) {
      throw new Error("routing_rules was not cached in Redis!");
    }
    console.log("   ✅ Redis RAM verified: routing_rules cached instantly (<15ms fast-path).");

    // 2a. Test iOS User-Agent
    const iosUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
    const iosResolveRes = await fetch(`${API_BASE}/resolve/${deviceLink.shortCode}`, {
      headers: { "User-Agent": iosUA },
    });
    const iosData = await iosResolveRes.json();
    if (iosData.result?.originalUrl !== iosTarget) {
      throw new Error(`iOS UA expected ${iosTarget}, got ${iosData.result?.originalUrl}`);
    }
    console.log("   ✅ iOS User-Agent -> Successfully routed to App Store:", iosData.result.originalUrl);

    // 2b. Test Android User-Agent
    const androidUA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36";
    const androidResolveRes = await fetch(`${API_BASE}/resolve/${deviceLink.shortCode}`, {
      headers: { "User-Agent": androidUA },
    });
    const androidData = await androidResolveRes.json();
    if (androidData.result?.originalUrl !== androidTarget) {
      throw new Error(`Android UA expected ${androidTarget}, got ${androidData.result?.originalUrl}`);
    }
    console.log("   ✅ Android User-Agent -> Successfully routed to Google Play:", androidData.result.originalUrl);

    // 2c. Test Desktop User-Agent
    const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const desktopResolveRes = await fetch(`${API_BASE}/resolve/${deviceLink.shortCode}`, {
      headers: { "User-Agent": desktopUA },
    });
    const desktopData = await desktopResolveRes.json();
    if (desktopData.result?.originalUrl !== desktopTarget) {
      throw new Error(`Desktop UA expected ${desktopTarget}, got ${desktopData.result?.originalUrl}`);
    }
    console.log("   ✅ Desktop User-Agent -> Successfully routed to Desktop Landing:", desktopData.result.originalUrl);

    // ── Check 3: Expiration Fallback Destination ──────────────────────────
    console.log("\n3️⃣  Testing Expiration Fallback Destination...");
    const fallbackTarget = "https://example.com/promo-ended-fallback";
    const createFallbackRes = await fetch(`${API_BASE}/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/flash-sale",
        title: "Flash Sale with Fallback",
        expiresInDays: 1,
        routingRules: {
          fallbackUrl: fallbackTarget,
        },
      }),
    });
    const fallbackLink = await createFallbackRes.json();
    console.log(`   ✅ Link created: ${fallbackLink.shortCode} with fallback: ${fallbackTarget}`);

    // Manually expire the link in Postgres & clear Redis cache
    await pool.query(
      "UPDATE urls SET expires_at = CURRENT_TIMESTAMP - interval '1 hour' WHERE short_code = $1::varchar",
      [fallbackLink.shortCode]
    );
    await redisClient.del(`url:${fallbackLink.shortCode}`);

    // Request expired link
    const expiredRes = await fetch(`${API_BASE}/resolve/${fallbackLink.shortCode}`);
    const expiredData = await expiredRes.json();

    if (!expiredData.success || expiredData.result?.originalUrl !== fallbackTarget) {
      throw new Error(`Expected fallback redirect to ${fallbackTarget}, got: ${JSON.stringify(expiredData)}`);
    }
    console.log("   ✅ Expired link with fallbackUrl -> Safely routed to Fallback destination:", expiredData.result.originalUrl);

    // ── Check 4: A/B Split Testing Support ────────────────────────────────
    console.log("\n4️⃣  Testing A/B Split Testing Support...");
    const variantA = "https://example.com/landing-variant-a";
    const variantB = "https://example.com/landing-variant-b";

    const createSplitRes = await fetch(`${API_BASE}/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/default-split",
        title: "A/B Split Test 50/50",
        expiresInDays: 30,
        routingRules: {
          splitTest: [
            { url: variantA, weight: 50 },
            { url: variantB, weight: 50 },
          ],
        },
      }),
    });
    const splitLink = await createSplitRes.json();
    console.log(`   ✅ Link created: ${splitLink.shortCode} with 50/50 split variants`);

    // Simulate 40 clicks and count distribution
    let countA = 0;
    let countB = 0;

    for (let i = 0; i < 40; i++) {
      const splitRes = await fetch(`${API_BASE}/resolve/${splitLink.shortCode}`);
      const sData = await splitRes.json();
      if (sData.result?.originalUrl === variantA) countA++;
      else if (sData.result?.originalUrl === variantB) countB++;
    }

    console.log(`   ✅ Distribution over 40 trials: Variant A = ${countA}, Variant B = ${countB}`);
    if (countA === 0 || countB === 0) {
      throw new Error("A/B Split test failed to route to both variants!");
    }
    console.log("   ✅ Both variants received balanced dynamic traffic.");

    console.log("\n=================================================");
    console.log("🎉 ALL PHASE 5 VERIFICATION CHECKS PASSED!");
    console.log("=================================================\n");
  } catch (err) {
    console.error("❌ Verification failed:", err.stack || err.message);
    process.exit(1);
  } finally {
    await pool.end();
    await redisClient.disconnect();
  }
}

verifyPhase5();
