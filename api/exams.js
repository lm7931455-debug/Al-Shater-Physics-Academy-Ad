const crypto = require("node:crypto");
const { sendJson, methodNotAllowed, readBody, getQueryId } = require("./_lib/http");
const { getSession } = require("./_lib/session");
const { selectRows, insertRow, updateRows, deleteRows, uploadObject, storagePathFromName } = require("./_lib/supabase");

function mediaUrl(storagePath) {
  if (!storagePath) return "";
  return `/api/media?path=${encodeURIComponent(storagePath)}`;
}

function serializeExam(row, includeCorrectAnswer = false, signedUrl = "") {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    title: row.title,
    questionText: row.question_text || "",
    fileName: row.file_name,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    imageUrl: signedUrl,
    correctAnswer: includeCorrectAnswer ? row.correct_answer : undefined,
    timeLimitMinutes: row.time_limit_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function toExamPayload(row, includeCorrectAnswer) {
  return serializeExam(row, includeCorrectAnswer, mediaUrl(row.storage_path));
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const includeCorrectAnswer = Boolean(getSession(req));
    const rows = await selectRows("exams", "select=*&order=created_at.desc");
    const payload = [];
    for (const row of rows) {
      payload.push(await toExamPayload(row, includeCorrectAnswer));
    }
    sendJson(res, 200, payload);
    return;
  }

  if (!getSession(req)) {
    sendJson(res, 401, { message: "Unauthorized" });
    return;
  }

  const id = getQueryId(req);

  if (req.method === "POST") {
    const body = await readBody(req);
    const file = body.file || {};
    const chapterId = String(body.chapterId || "").trim();
    const correctAnswer = String(body.correctAnswer || "").trim().toUpperCase();
    const timeLimitMinutes = Number(body.timeLimitMinutes || 1);

    if (!chapterId || !file.dataUrl || !["A", "B", "C", "D"].includes(correctAnswer)) {
      sendJson(res, 400, { message: "Missing exam data" });
      return;
    }

    const storagePath = storagePathFromName(`exams/${chapterId}`, file.name || `exam-${Date.now()}.png`);
    await uploadObject("physicsstudio-media", storagePath, file.dataUrl, file.type);

    const row = {
      id: crypto.randomUUID(),
      chapter_id: chapterId,
      title: String(body.title || "").trim(),
      question_text: String(body.questionText || "").trim(),
      storage_path: storagePath,
      file_name: String(file.name || "exam").trim(),
      mime_type: String(file.type || "image/png").trim(),
      correct_answer: correctAnswer,
      time_limit_minutes: Number.isFinite(timeLimitMinutes) && timeLimitMinutes > 0 ? timeLimitMinutes : 1,
    };

    const rows = await insertRow("exams", row);
    const payload = await toExamPayload(rows[0], true);
    sendJson(res, 201, payload);
    return;
  }

  if (req.method === "PUT") {
    const body = await readBody(req);
    const examId = String(body.id || id || "").trim();
    if (!examId) {
      sendJson(res, 400, { message: "Missing exam id" });
      return;
    }

    const update = {
      title: String(body.title || "").trim(),
      question_text: String(body.questionText || "").trim(),
      chapter_id: String(body.chapterId || "").trim(),
      correct_answer: String(body.correctAnswer || "").trim().toUpperCase(),
      time_limit_minutes: Number(body.timeLimitMinutes || 1),
      updated_at: new Date().toISOString(),
    };

    const rows = await updateRows("exams", [`id=eq.${encodeURIComponent(examId)}`], update);
    const payload = await toExamPayload(rows[0], true);
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === "DELETE") {
    const examId = String(id || "").trim();
    if (!examId) {
      sendJson(res, 400, { message: "Missing exam id" });
      return;
    }

    await deleteRows("exams", [`id=eq.${encodeURIComponent(examId)}`]);
    sendJson(res, 200, { ok: true });
    return;
  }

  methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
};
