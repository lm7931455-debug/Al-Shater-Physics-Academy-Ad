const crypto = require("node:crypto");
const { sendJson, methodNotAllowed, readBody, getQueryId } = require("./_lib/http");
const { getSession } = require("./_lib/session");
const { selectRows, insertRow, updateRows, deleteRows } = require("./_lib/supabase");

function serializeChapter(row) {
  return {
    id: row.id,
    grade: row.grade,
    title: row.title,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const rows = await selectRows("chapters", "select=*&order=sort_order.asc");
    sendJson(res, 200, rows.map(serializeChapter));
    return;
  }

  if (!getSession(req)) {
    sendJson(res, 401, { message: "Unauthorized" });
    return;
  }

  const id = getQueryId(req);

  if (req.method === "POST") {
    const body = await readBody(req);
    const payload = {
      id: crypto.randomUUID(),
      grade: String(body.grade || "").trim(),
      title: String(body.title || "").trim(),
      sort_order: Number(body.sortOrder || body.sort_order || 0),
    };

    if (!payload.grade || !payload.title) {
      sendJson(res, 400, { message: "Missing chapter data" });
      return;
    }

    const rows = await insertRow("chapters", payload);
    sendJson(res, 201, serializeChapter(rows[0]));
    return;
  }

  if (req.method === "PUT") {
    const body = await readBody(req);
    const chapterId = String(body.id || id || "").trim();
    if (!chapterId) {
      sendJson(res, 400, { message: "Missing chapter id" });
      return;
    }

    const rows = await updateRows(
      "chapters",
      [`id=eq.${encodeURIComponent(chapterId)}`],
      {
        grade: String(body.grade || "").trim(),
        title: String(body.title || "").trim(),
        sort_order: Number(body.sortOrder || body.sort_order || 0),
        updated_at: new Date().toISOString(),
      },
    );
    sendJson(res, 200, serializeChapter(rows[0]));
    return;
  }

  if (req.method === "DELETE") {
    const chapterId = String(id || "").trim();
    if (!chapterId) {
      sendJson(res, 400, { message: "Missing chapter id" });
      return;
    }

    await deleteRows("chapters", [`id=eq.${encodeURIComponent(chapterId)}`]);
    await deleteRows("materials", [`chapter_id=eq.${encodeURIComponent(chapterId)}`]);
    await deleteRows("exams", [`chapter_id=eq.${encodeURIComponent(chapterId)}`]);
    sendJson(res, 200, { ok: true });
    return;
  }

  methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
};
