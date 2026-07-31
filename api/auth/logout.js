const { sendJson, methodNotAllowed } = require("../_lib/http");
const { clearCookie } = require("../_lib/session");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  sendJson(
    res,
    200,
    { ok: true },
    {
      "Set-Cookie": clearCookie(),
    },
  );
};
