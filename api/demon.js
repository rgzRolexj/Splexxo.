// ==================== CONFIG =====================
const YOUR_API_KEYS = ["SPLEXXO"];
const TARGET_API = "https://demon.taitanx.workers.dev";
const CACHE_TIME = 3600 * 1000;
// ==================================================

const cache = new Map();

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { mobile: rawMobile, key: rawKey } = req.query || {};

  if (!rawMobile || !rawKey) {
    return res.status(400).json({ error: "missing parameters" });
  }

  const mobile = String(rawMobile).replace(/\D/g, "");
  const key = String(rawKey).trim();

  if (!YOUR_API_KEYS.includes(key)) {
    return res.status(403).json({ error: "invalid key" });
  }

  const now = Date.now();
  const cached = cache.get(mobile);

  if (cached && now - cached.timestamp < CACHE_TIME) {
    res.setHeader("X-Proxy-Cache", "HIT");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(cached.response);
  }

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

    try {
      const data = JSON.parse(raw);

      // ❌ Remove "@oxmzoo" completely
      if (data["@oxmzoo"]) delete data["@oxmzoo"];
      for (const k in data) {
        if (typeof data[k] === "string" && data[k].includes("@oxmzoo")) {
          delete data[k];
        }
      }

      // ❌ Remove any Demon Proxy / Proxy / prefix / unwanted text
      for (const k in data) {
        if (typeof data[k] === "string") {
          data[k] = data[k]
            .replace(/demon proxy/gi, "")
            .replace(/proxy/gi, "")
            .replace(/demon/gi, "")
            .trim();
        }
      }

      // ✔ Add your clean branding
      data.developer = "splexxo";       // Sirf NAME
      data.powered_by = "splexxo API"; // Clean, no proxy, no demon

      responseBody = JSON.stringify(data);
    } catch {
      responseBody = raw;
    }

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
