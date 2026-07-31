const crypto = require("node:crypto");

const SECRET = process.env.PHYSICSSTUDIO_SESSION_SECRET || "physicsstudio-session-secret";
const COOKIE_NAME = "physicsstudio_admin";
const COOKIE_MAX_AGE = 60 * 60 * 12;

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signToken(payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, pair) => {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function getAdminToken(req) {
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME] || "";
}

function getSession(req) {
  return verifyToken(getAdminToken(req));
}

function buildCookie(value) {
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function issueAdminToken() {
  return signToken({
    role: "admin",
    exp: Date.now() + COOKIE_MAX_AGE * 1000,
  });
}

module.exports = {
  getSession,
  buildCookie,
  clearCookie,
  issueAdminToken,
  COOKIE_NAME,
};
