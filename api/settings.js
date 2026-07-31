const { sendJson, methodNotAllowed, readBody } = require("./_lib/http");
const { getSession } = require("./_lib/session");
const { selectRows, upsertRow, uploadObject, storagePathFromName } = require("./_lib/supabase");

function mediaUrl(storagePath) {
  if (!storagePath) return "";
  return `/api/media?path=${encodeURIComponent(storagePath)}`;
}

const SETTINGS_META_SEPARATOR = "\n__PHYSICSSTUDIO_META__\n";

function splitMarqueePayload(value) {
  const raw = String(value || "");
  const separatorIndex = raw.indexOf(SETTINGS_META_SEPARATOR);
  if (separatorIndex === -1) {
    return {
      marqueeText: raw,
      meta: {},
    };
  }

  const marqueeText = raw.slice(0, separatorIndex);
  const metaRaw = raw.slice(separatorIndex + SETTINGS_META_SEPARATOR.length);
  try {
    return {
      marqueeText,
      meta: JSON.parse(metaRaw),
    };
  } catch (_) {
    return {
      marqueeText,
      meta: {},
    };
  }
}

function serializeMarqueePayload(marqueeText, meta = {}) {
  return `${String(marqueeText || "")}${SETTINGS_META_SEPARATOR}${JSON.stringify({
    siteLocked: Boolean(meta.siteLocked),
    whatsappVisible: meta.whatsappVisible == null ? true : Boolean(meta.whatsappVisible),
  })}`;
}

function serializeSettings(row, teacherImageUrl = "") {
  const decoded = splitMarqueePayload(row.marquee_text);
  return {
    id: row.id,
    teacherImageUrl,
    teacherImagePath: row.teacher_image_path || "",
    marqueeText: decoded.marqueeText || "",
    siteLocked: decoded.meta.siteLocked == null ? false : Boolean(decoded.meta.siteLocked),
    whatsappVisible: decoded.meta.whatsappVisible == null ? true : Boolean(decoded.meta.whatsappVisible),
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

  return serializeSettings(row, mediaUrl(row.teacher_image_path));
}

module.exports = async function handler(req, res) {
  try {
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
    const currentDecoded = splitMarqueePayload(current?.marquee_text || "");
    const nextMeta = {
      siteLocked: body.siteLocked == null ? Boolean(currentDecoded.meta.siteLocked ?? false) : Boolean(body.siteLocked),
      whatsappVisible:
        body.whatsappVisible == null
          ? currentDecoded.meta.whatsappVisible == null
            ? true
            : Boolean(currentDecoded.meta.whatsappVisible)
          : Boolean(body.whatsappVisible),
    };

    if (body.file && body.file.dataUrl) {
      teacherImagePath = storagePathFromName("settings/teacher", body.file.name || "teacher-image.png");
      await uploadObject("physicsstudio-media", teacherImagePath, body.file.dataUrl, body.file.type);
    }

    const next = {
      id: 1,
      teacher_image_path: teacherImagePath,
      marquee_text: serializeMarqueePayload(
        String(body.marqueeText ?? currentDecoded.marqueeText ?? "").trim(),
        nextMeta,
      ),
      whatsapp_number: String(body.whatsappNumber || current?.whatsapp_number || "").trim(),
      updated_at: new Date().toISOString(),
    };

    const rows = await upsertRow("settings", next, { onConflict: "id" });
    const payload = await resolveSettings(rows[0]);
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 500, { message: error.message || "Failed to update settings" });
  }
};
