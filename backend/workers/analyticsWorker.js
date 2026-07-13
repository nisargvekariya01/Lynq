import redisClient from "../config/redis.js";
import pool from "../config/db.js";
import crypto from "crypto";

const BATCH_SIZE = 500;
const INTERVAL_MS = 5000;

export const startAnalyticsWorker = () => {
  console.log("👷 v2 Analytics Worker started. Processing queue every 5s...");

  setInterval(async () => {
    try {
      const queueLen = await redisClient.lLen("analytics_queue");
      if (queueLen === 0) return;

      const itemsToFetch = Math.min(queueLen, BATCH_SIZE);

      const multi = redisClient.multi();
      multi.lRange("analytics_queue", 0, itemsToFetch - 1);
      multi.lTrim("analytics_queue", itemsToFetch, -1);

      const [rawItems] = await multi.exec();

      if (!rawItems || rawItems.length === 0) return;

      const clicks = rawItems.map((item) => JSON.parse(item));

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        let historyValues = [];
        let historyQueryStr =
          "INSERT INTO click_history (short_code, visitor_hash, user_agent, clicked_at) VALUES ";
        let paramIdx = 1;

        let uniqueValues = [];
        let uniqueQueryStr =
          "INSERT INTO unique_visitors (short_code, visitor_hash) VALUES ";
        let uniqueParamIdx = 1;

        const urlClicksMap = {};
        const urlLastVisitMap = {};
        const seenUniqueInBatch = new Set();

        clicks.forEach((click) => {
          const visitorString = `${click.ip}-${click.userAgent}`;
          const visitorHash = crypto
            .createHash("md5")
            .update(visitorString)
            .digest("hex");

          historyQueryStr += `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}),`;
          historyValues.push(
            click.shortCode,
            visitorHash,
            click.userAgent,
            click.timestamp,
          );

          const uniqueKey = `${click.shortCode}:${visitorHash}`;
          if (!seenUniqueInBatch.has(uniqueKey)) {
            seenUniqueInBatch.add(uniqueKey);
            uniqueQueryStr += `($${uniqueParamIdx++}, $${uniqueParamIdx++}),`;
            uniqueValues.push(click.shortCode, visitorHash);
          }

          if (!urlClicksMap[click.shortCode]) urlClicksMap[click.shortCode] = 0;
          urlClicksMap[click.shortCode]++;

          if (
            !urlLastVisitMap[click.shortCode] ||
            click.timestamp > urlLastVisitMap[click.shortCode]
          ) {
            urlLastVisitMap[click.shortCode] = click.timestamp;
          }
        });

        historyQueryStr = historyQueryStr.slice(0, -1);
        uniqueQueryStr =
          uniqueQueryStr.slice(0, -1) +
          " ON CONFLICT (short_code, visitor_hash) DO NOTHING";

        if (historyValues.length > 0) {
          await client.query(historyQueryStr, historyValues);
          await client.query(uniqueQueryStr, uniqueValues);
        }

        const uniqueShortCodes = Object.keys(urlClicksMap);
        for (const code of uniqueShortCodes) {
          await client.query(
            "UPDATE urls SET clicks = clicks + $1, last_visited = GREATEST(COALESCE(last_visited, $2::timestamp), $2::timestamp) WHERE short_code = $3",
            [urlClicksMap[code], urlLastVisitMap[code], code],
          );
        }

        const maxClicksResult = await client.query(
          `
          SELECT urls.id, urls.short_code 
          FROM urls 
          JOIN (
            SELECT short_code, COUNT(*) as count 
            FROM unique_visitors 
            WHERE short_code = ANY($1) 
            GROUP BY short_code
          ) uv ON urls.short_code = uv.short_code 
          WHERE urls.max_clicks IS NOT NULL AND uv.count >= urls.max_clicks
        `,
          [uniqueShortCodes],
        );

        for (const row of maxClicksResult.rows) {
          await client.query("DELETE FROM urls WHERE id = $1", [row.id]);
          await redisClient.del(`url:${row.short_code}`);
        }

        await client.query("COMMIT");
        console.log(
          `✅ Worker bulk-processed ${clicks.length} analytics events.`,
        );
      } catch (dbErr) {
        await client.query("ROLLBACK");
        console.error("❌ Bulk analytics transaction failed:", dbErr.message);
        // Put the items back in the queue if DB fails (prevents data loss)
        await redisClient.lPush("analytics_queue", rawItems);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("❌ Analytics worker error:", err.message);
    }
  }, INTERVAL_MS);
};
