const crypto = require("node:crypto");
const { sendJson, methodNotAllowed, readBody, getQueryId } = require("./_lib/http");
const { getSession } = require("./_lib/session");
const { selectRows, insertRow, updateRows, deleteRows, uploadObject, createSignedUrl, storagePathFromName } = require("./_lib/supabase");

function serializeMaterial(row, signedUrl = "") {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    title: row.title,
    fileName: row.file_name,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    signedUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function toPublicMaterial(row) {
  const signed = row.storage_path ? await createSignedUrl("physicsstudio-media", row.storage_path, 60 * 60 * 24) : null;
  return serializeMaterial(row, signed?.signedURL || "");
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const rows = await selectRows("materials", "select=*&order=created_at.desc");
    const payload = [];
    for (const row of rows) {
      payload.push(await toPublicMaterial(row));
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
    const title = String(body.title || "").trim();
    const chapterId = String(body.chapterId || "").trim();

    if (!chapterId || !title || !file.dataUrl) {
      sendJson(res, 400, { message: "Missing material data" });
      return;
    }

    const storagePath = storagePathFromName(`materials/${chapterId}`, file.name || `${title}.pdf`);
    await uploadObject("physicsstudio-media", storagePath, file.dataUrl, file.type);

    const row = {
      id: crypto.randomUUID(),
      chapter_id: chapterId,
      title,
      storage_path: storagePath,
      file_name: String(file.name || title).trim(),
      mime_type: String(file.type || "application/octet-stream").trim(),
    };

    const rows = await insertRow("materials", row);
    const payload = await toPublicMaterial(rows[0]);
    sendJson(res, 201, payload);
    return;
  }

  if (req.method === "PUT") {
    const body = await readBody(req);
    const materialId = String(body.id || id || "").trim();
    if (!materialId) {
      sendJson(res, 400, { message: "Missing material id" });
      return;
    }

    const update = {
      title: String(body.title || "").trim(),
      chapter_id: String(body.chapterId || "").trim(),
      updated_at: new Date().toISOString(),
    };

    const rows = await updateRows("materials", [`id=eq.${encodeURIComponent(materialId)}`], update);
    const payload = await toPublicMaterial(rows[0]);
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === "DELETE") {
    const materialId = String(id || "").trim();
    if (!materialId) {
      sendJson(res, 400, { message: "Missing material id" });
      return;
    }

    await deleteRows("materials", [`id=eq.${encodeURIComponent(materialId)}`]);
    sendJson(res, 200, { ok: true });
    return;
  }

  methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
};
