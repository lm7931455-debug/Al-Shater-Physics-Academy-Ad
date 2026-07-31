const crypto = require("node:crypto");
const { sendJson, methodNotAllowed, readBody, getQueryId } = require("./_lib/http");
const { getSession } = require("./_lib/session");
const { selectRows, insertRow, updateRows, deleteRows } = require("./_lib/supabase");

function serializeStudent(row, includeSensitive = false) {
  const payload = {
    id: row.id,
    fullName: row.full_name,
    studentNumber: row.student_number,
    school: row.school,
    grade: row.grade,
    score: Number(row.score || 0),
    blocked: Boolean(row.blocked),
    lastExamId: row.last_exam_id,
    lastExamAt: row.last_exam_at,
    securityAlert: Boolean(row.security_alert),
    securityAlertReason: row.security_alert_reason || "",
    securityAlertAt: row.security_alert_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includeSensitive) {
    payload.mobileNumber = row.mobile_number;
    payload.guardianNumber = row.guardian_number;
    payload.lastIp = row.last_ip || "";
    payload.lastUserAgent = row.last_user_agent || "";
    payload.lastDeviceType = row.last_device_type || "";
  }

  return payload;
}

module.exports = async function handler(req, res) {
  const session = getSession(req);

  if (req.method === "GET") {
    const rows = await selectRows("students", "select=*&order=updated_at.desc");
    const payload = rows
      .filter((row) => !row.blocked || session)
      .map((row) => serializeStudent(row, Boolean(session)));
    sendJson(res, 200, payload);
    return;
  }

  if (!session) {
    sendJson(res, 401, { message: "Unauthorized" });
    return;
  }

  const id = getQueryId(req);

  if (req.method === "PUT") {
    const body = await readBody(req);
    const studentId = String(body.id || id || "").trim();
    if (!studentId) {
      sendJson(res, 400, { message: "Missing student id" });
      return;
    }

    const rows = await updateRows("students", [`id=eq.${encodeURIComponent(studentId)}`], {
      full_name: String(body.fullName || "").trim(),
      student_number: String(body.studentNumber || "").trim(),
      mobile_number: String(body.mobileNumber || "").trim(),
      guardian_number: String(body.guardianNumber || "").trim(),
      school: String(body.school || "").trim(),
      grade: String(body.grade || "").trim(),
      score: body.score === "" || body.score == null ? 0 : Number(body.score),
      blocked: Boolean(body.blocked),
      updated_at: new Date().toISOString(),
    });

    sendJson(res, 200, serializeStudent(rows[0], true));
    return;
  }

  if (req.method === "DELETE") {
    const studentId = String(id || "").trim();
    if (!studentId) {
      sendJson(res, 400, { message: "Missing student id" });
      return;
    }

    await deleteRows("students", [`id=eq.${encodeURIComponent(studentId)}`]);
    sendJson(res, 200, { ok: true });
    return;
  }

  methodNotAllowed(res, ["GET", "PUT", "DELETE"]);
};
