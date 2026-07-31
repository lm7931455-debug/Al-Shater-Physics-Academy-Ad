const { sendJson, methodNotAllowed, readBody } = require("../_lib/http");
const { buildCookie, issueAdminToken } = require("../_lib/session");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  const body = await readBody(req);
  if (String(body.password || "") !== "111") {
    sendJson(res, 401, { message: "الباسورد غير صحيح" });
    return;
  }

  const token = issueAdminToken();
  sendJson(
    res,
    200,
    {
      ok: true,
    },
    {
      "Set-Cookie": buildCookie(token),
    },
  );
};
