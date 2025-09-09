export const API_BASE = import.meta.env.VITE_API_BASE || "";
export const apiUrl = (path) => `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1");

export async function postJSON(path, data) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => ({}));
}

export async function upload(path, file, fieldName = "file") {
  const fd = new FormData();
  fd.append(fieldName, file);
  const res = await fetch(apiUrl(path), { method: "POST", body: fd });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

