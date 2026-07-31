const { StringDecoder } = require("node:string_decoder");

function sendJson(res, statusCode, data, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(data));
}

function methodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  sendJson(res, 405, { message: "Method Not Allowed" });
}

function notFound(res) {
  sendJson(res, 404, { message: "Not Found" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder("utf8");
    let body = "";
    req.on("data", (chunk) => {
      body += decoder.write(chunk);
    });
    req.on("end", () => {
      body += decoder.end();
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getQueryId(req) {
  const url = new URL(req.url, "http://localhost");
  return url.searchParams.get("id");
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    return String(forwardedFor).split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return String(realIp).trim();
  }

  return String(req.socket?.remoteAddress || req.connection?.remoteAddress || "").trim();
}

function getUserAgent(req) {
  return String(req.headers["user-agent"] || "").trim();
}

module.exports = {
  sendJson,
  methodNotAllowed,
  notFound,
  readBody,
  getQueryId,
  getClientIp,
  getUserAgent,
};
