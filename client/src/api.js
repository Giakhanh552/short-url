const API_BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 204) {
    return null;
  }

  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }

  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return body;
}

export function listLinks() {
  return request("/api/links");
}

export function getLink(id) {
  return request(`/api/links/${id}`);
}

export function createLink(longUrl) {
  return request("/api/links", {
    method: "POST",
    body: JSON.stringify({ longUrl }),
  });
}

export function updateLink(id, longUrl) {
  return request(`/api/links/${id}`, {
    method: "PUT",
    body: JSON.stringify({ longUrl }),
  });
}

export function deleteLink(id) {
  return request(`/api/links/${id}`, {
    method: "DELETE",
  });
}

export function shortUrlPath(shortCode) {
  return `/r/${shortCode}`;
}
