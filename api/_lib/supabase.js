const { getSupabaseConfig } = require("./env");

function encodeStoragePath(storagePath) {
  return String(storagePath)
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL");
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function storagePathFromName(prefix, name) {
  const safeName = String(name || "file")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const uuid = crypto.randomUUID();
  return `${prefix}/${uuid}-${safeName || "file"}`;
}

const crypto = require("node:crypto");

async function supabaseRequest(path, options = {}, useServiceRole = true) {
  const { url, serviceRoleKey, anonKey } = getSupabaseConfig();
  const key = useServiceRole ? serviceRoleKey : anonKey;
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = payload && typeof payload === "object" && payload.message ? payload.message : "Supabase request failed";
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function selectRows(table, query = "select=*") {
  return supabaseRequest(`/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Prefer: "return=representation",
    },
  });
}

async function insertRow(table, body, options = {}) {
  const query = options.onConflict ? `?on_conflict=${encodeURIComponent(options.onConflict)}` : "";
  return supabaseRequest(`/rest/v1/${table}${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
    body: JSON.stringify(Array.isArray(body) ? body : [body]),
  });
}

async function upsertRow(table, body, options = {}) {
  const query = options.onConflict ? `?on_conflict=${encodeURIComponent(options.onConflict)}` : "";
  return supabaseRequest(`/rest/v1/${table}${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      ...(options.headers || {}),
    },
    body: JSON.stringify(Array.isArray(body) ? body : [body]),
  });
}

async function updateRows(table, filters, body) {
  const query = filters.length ? `?${filters.join("&")}` : "";
  return supabaseRequest(`/rest/v1/${table}${query}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
}

async function deleteRows(table, filters) {
  const query = filters.length ? `?${filters.join("&")}` : "";
  return supabaseRequest(`/rest/v1/${table}${query}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });
}

async function uploadObject(bucket, storagePath, dataUrlOrBuffer, contentType) {
  const { url } = getSupabaseConfig();
  const { buffer, contentType: inferredType } =
    typeof dataUrlOrBuffer === "string" && dataUrlOrBuffer.startsWith("data:")
      ? decodeDataUrl(dataUrlOrBuffer)
      : { buffer: Buffer.isBuffer(dataUrlOrBuffer) ? dataUrlOrBuffer : Buffer.from(dataUrlOrBuffer), contentType: contentType };

  const finalContentType = contentType || inferredType || "application/octet-stream";
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${encodeStoragePath(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: getSupabaseConfig().serviceRoleKey,
      Authorization: `Bearer ${getSupabaseConfig().serviceRoleKey}`,
      "Content-Type": finalContentType,
      "x-upsert": "true",
    },
    body: buffer,
  });

  if (!response.ok) {
    const payload = await response.text();
    const error = new Error(payload || "Storage upload failed");
    error.status = response.status;
    throw error;
  }

  return {
    storagePath,
  };
}

async function createSignedUrl(bucket, storagePath, expiresIn = 60 * 60 * 24) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/storage/v1/object/sign/${bucket}/${encodeStoragePath(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ expiresIn }),
  });

  const payload = await response.json().catch(async () => ({ message: await response.text() }));
  if (!response.ok) {
    const error = new Error(payload?.message || "Failed to create signed URL");
    error.status = response.status;
    throw error;
  }

  const signedURL = payload?.signedURL || payload?.signedUrl || payload?.signed_url || "";
  return {
    ...payload,
    signedURL: signedURL.startsWith("http") ? signedURL : `${url}${signedURL}`,
  };
}

module.exports = {
  supabaseRequest,
  selectRows,
  insertRow,
  updateRows,
  deleteRows,
  upsertRow,
  uploadObject,
  createSignedUrl,
  storagePathFromName,
  encodeStoragePath,
  decodeDataUrl,
};
