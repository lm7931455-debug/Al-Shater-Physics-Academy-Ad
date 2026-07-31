const { sendJson, methodNotAllowed } = require("../_lib/http");
const { getSession } = require("../_lib/session");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { message: "Unauthorized" });
    return;
  }

  sendJson(res, 200, { ok: true, session });
};
