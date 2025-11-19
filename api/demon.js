// ==================== CONFIG =====================
const YOUR_API_KEYS = ["SPLEXXO"]; // tumhari private keys
const TARGET_API = "https://demon.taitanx.workers.dev"; // original API
const CACHE_TIME = 3600 * 1000; // 1 hour (ms)
// ==================================================

const cache = new Map();

module.exports = async (req, res) => {
  // Sirf GET allow
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  // Query params
  const { mobile: rawMobile, key: rawKey } = req.query || {};

  // Param check
  if (!rawMobile || !rawKey) {
    return res.status(400).json({ error: "missing parameters" });
  }

  // Sanitise
  const mobile = String(rawMobile).replace(/\D/g, ""); // sirf digits
  const key = String(rawKey).trim();

  // Key validate
  if (!YOUR_API_KEYS.includes(key)) {
    return res.status(403).json({ error: "invalid key" });
  }

  // Cache check
  const now = Date.now();
  const cached = cache.get(mobile);

  if (cached && now - cached.timestamp < CACHE_TIME) {
    res.setHeader("X-Proxy-Cache", "HIT");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(cached.response);
  }

  // Upstream URL
  const url = `${TARGET_API}?mobile=${encodeURIComponent(mobile)}`;

  try {
    const upstream = await fetch(url);
    const raw = await upstream.text();

    if (!upstream.ok || !raw) {
      return res.status(502).json({
        error: "upstream API failed",
        details: `HTTP ${upstream.status}`,
      });
    }

    let responseBody;

    // JSON try–catch
    try {
      const data = JSON.parse(raw);
      data.developer = "splexxo";
      data.powered_by = "splexxo Demon API";
      responseBody = JSON.stringify(data);
    } catch {
      // Agar JSON nahi hai to raw hi bhej do
      responseBody = raw;
    }

    // Cache save
    cache.set(mobile, {
      timestamp: Date.now(),
      response: responseBody,
    });

    res.setHeader("X-Proxy-Cache", "MISS");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(responseBody);
  } catch (err) {
    return res.status(502).json({
      error: "upstream API error",
      details: err.message,
    });
  }
};
