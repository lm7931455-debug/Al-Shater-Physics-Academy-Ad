const { URL } = require("node:url");
const { sendJson, methodNotAllowed } = require("./_lib/http");
const { createSignedUrl } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    const url = new URL(req.url, "http://localhost");
    const path = String(url.searchParams.get("path") || "").trim();

    if (!path || !/^(settings|exams|materials)\//.test(path)) {
      sendJson(res, 400, { message: "Missing image path" });
      return;
    }

    const signed = await createSignedUrl("physicsstudio-media", path, 60 * 10);
    const upstream = await fetch(signed.signedURL);
    if (!upstream.ok) {
      sendJson(res, upstream.status, { message: "Failed to fetch image" });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.end(buffer);
  } catch (error) {
    sendJson(res, 500, { message: error.message || "Failed to load image" });
  }
};
