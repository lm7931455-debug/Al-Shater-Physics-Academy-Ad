(() => {
  function byId(id) {
    return document.getElementById(id);
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = payload && typeof payload === "object" && payload.message ? payload.message : "Request failed";
      throw new Error(message);
    }

    return payload;
  }

  function formatDateTime(value) {
    if (!value) return "غير محدد";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function fileToDataUrl(file) {
    if (!file) return Promise.resolve("");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
      reader.readAsDataURL(file);
    });
  }

  function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv(filename, rows) {
    const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
    downloadTextFile(filename, `\ufeff${csv}`, "text/csv;charset=utf-8");
  }

  function toast(message, tone = "info") {
    let host = byId("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className = "fixed bottom-4 left-4 z-50 grid gap-2";
      document.body.appendChild(host);
    }

    const node = document.createElement("div");
    const palette =
      tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-sky-200 bg-sky-50 text-sky-900";
    node.className = `max-w-sm rounded-2xl border px-4 py-3 shadow-lg transition ${palette}`;
    node.textContent = message;
    host.appendChild(node);

    window.setTimeout(() => {
      node.style.opacity = "0";
      node.style.transform = "translateY(8px)";
      window.setTimeout(() => node.remove(), 220);
    }, 2400);
  }

  window.PhysicsStudio = {
    byId,
    qs,
    qsa,
    escapeHtml,
    request,
    formatDateTime,
    fileToDataUrl,
    downloadCsv,
    downloadTextFile,
    toast,
  };
})();
