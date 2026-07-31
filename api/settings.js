const { sendJson, methodNotAllowed, readBody } = require("./_lib/http");
const { getSession } = require("./_lib/session");
const { selectRows, upsertRow, createSignedUrl, uploadObject, storagePathFromName } = require("./_lib/supabase");

function serializeSettings(row, teacherImageUrl = "") {
  return {
    id: row.id,
    teacherImageUrl,
    teacherImagePath: row.teacher_image_path || "",
    marqueeText: row.marquee_text || "",
    siteLocked: Boolean(row.site_locked),
    whatsappVisible: row.whatsapp_visible !== false,
    whatsappNumber: row.whatsapp_number || "",
    updatedAt: row.updated_at || null,
  };
}

async function loadSettingsRow() {
  const rows = await selectRows("settings", "select=*&id=eq.1&limit=1");
  return rows[0] || null;
}

async function resolveSettings(row) {
  if (!row) {
    return {
      id: 1,
      teacherImageUrl: "",
      teacherImagePath: "",
      marqueeText: "",
      siteLocked: false,
      whatsappVisible: true,
      whatsappNumber: "",
      updatedAt: null,
    };
  }

  let teacherImageUrl = "";
  if (row.teacher_image_path) {
    const signed = await createSignedUrl("physicsstudio-media", row.teacher_image_path, 60 * 60 * 24);
    teacherImageUrl = signed.signedURL;
  }

  return serializeSettings(row, teacherImageUrl);
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const row = await loadSettingsRow();
    const payload = await resolveSettings(row);
    sendJson(res, 200, payload);
    return;
  }

  if (req.method !== "PUT" && req.method !== "POST") {
    methodNotAllowed(res, ["GET", "PUT", "POST"]);
    return;
  }

  if (!getSession(req)) {
    sendJson(res, 401, { message: "Unauthorized" });
    return;
  }

  const body = await readBody(req);
  const current = await loadSettingsRow();
  let teacherImagePath = String(body.teacherImagePath || body.teacherImageUrl || current?.teacher_image_path || "").trim();

  if (body.file && body.file.dataUrl) {
    teacherImagePath = storagePathFromName("settings/teacher", body.file.name || "teacher-image.png");
    await uploadObject("physicsstudio-media", teacherImagePath, body.file.dataUrl, body.file.type);
  }

  const next = {
    id: 1,
    teacher_image_path: teacherImagePath,
    marquee_text: String(body.marqueeText || current?.marquee_text || "").trim(),
    site_locked: Boolean(body.siteLocked ?? current?.site_locked ?? false),
    whatsapp_visible: body.whatsappVisible == null ? Boolean(current?.whatsapp_visible ?? true) : Boolean(body.whatsappVisible),
    whatsapp_number: String(body.whatsappNumber || current?.whatsapp_number || "").trim(),
    updated_at: new Date().toISOString(),
  };

  const rows = await upsertRow("settings", next, { onConflict: "id" });
  const payload = await resolveSettings(rows[0]);
  sendJson(res, 200, payload);
};
