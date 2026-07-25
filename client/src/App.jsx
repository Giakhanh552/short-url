import { useCallback, useEffect, useState } from "react";
import {
  createLink,
  deleteLink,
  listLinks,
  shortUrlPath,
  updateLink,
} from "./api";
import "./App.css";

function isValidUrlInput(value) {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function App() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editUrl, setEditUrl] = useState("");
  const [actionBusy, setActionBusy] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listLinks();
      setLinks(res.data || []);
    } catch (err) {
      setError(
        err.message ||
          "Không tải được danh sách. Kiểm tra mạng hoặc server."
      );
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    if (!isValidUrlInput(formUrl)) {
      setFormError("Nhập URL hợp lệ bắt đầu bằng http:// hoặc https://");
      return;
    }
    setSubmitting(true);
    try {
      await createLink(formUrl.trim());
      setFormUrl("");
      await loadLinks();
    } catch (err) {
      setFormError(err.message || "Tạo link thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(link) {
    setEditingId(link.id);
    setEditUrl(link.longUrl);
    setFormError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditUrl("");
  }

  async function saveEdit(id) {
    if (!isValidUrlInput(editUrl)) {
      setFormError("URL sửa không hợp lệ");
      return;
    }
    setActionBusy(id);
    setFormError("");
    try {
      await updateLink(id, editUrl.trim());
      setEditingId(null);
      await loadLinks();
    } catch (err) {
      setFormError(err.message || "Cập nhật thất bại");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDelete(link) {
    const ok = window.confirm(
      `Xoá link ngắn /r/${link.shortCode}?\nThao tác này không hoàn tác.`
    );
    if (!ok) return;

    setActionBusy(link.id);
    setError("");
    try {
      await deleteLink(link.id);
      await loadLinks();
    } catch (err) {
      setError(err.message || "Xoá thất bại");
    } finally {
      setActionBusy(null);
    }
  }

  async function copyShort(link) {
    const absolute = `${window.location.origin}${shortUrlPath(link.shortCode)}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError("Không copy được — hãy chọn và copy thủ công.");
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="brand">Shortly</p>
        <h1>Rút gọn link cho vui</h1>
        <p className="lede">
          Tạo, sửa, xoá link ngắn — đếm lượt click, sẵn sàng cho DevOps lab.
        </p>
      </header>

      <main className="panel">
        <form className="create-form" onSubmit={handleCreate} noValidate>
          <label htmlFor="longUrl">URL dài</label>
          <div className="row">
            <input
              id="longUrl"
              type="url"
              placeholder="https://example.com/very/long/path"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              disabled={submitting}
              autoComplete="off"
            />
            <button type="submit" disabled={submitting}>
              {submitting ? "Đang tạo…" : "Rút gọn"}
            </button>
          </div>
          {formError ? <p className="msg error">{formError}</p> : null}
        </form>

        <div className="list-header">
          <h2>Danh sách</h2>
          <button
            type="button"
            className="ghost"
            onClick={loadLinks}
            disabled={loading}
          >
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
        </div>

        {error ? (
          <div className="banner error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={loadLinks}>
              Thử lại
            </button>
          </div>
        ) : null}

        {loading && links.length === 0 ? (
          <p className="msg muted">Đang tải danh sách…</p>
        ) : null}

        {!loading && !error && links.length === 0 ? (
          <p className="msg muted">Chưa có link nào. Tạo link đầu tiên ở trên.</p>
        ) : null}

        <ul className="link-list">
          {links.map((link) => (
            <li key={link.id} className="link-item">
              {editingId === link.id ? (
                <div className="edit-block">
                  <input
                    type="url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    disabled={actionBusy === link.id}
                  />
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => saveEdit(link.id)}
                      disabled={actionBusy === link.id}
                    >
                      {actionBusy === link.id ? "Lưu…" : "Lưu"}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={cancelEdit}
                      disabled={actionBusy === link.id}
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="link-main">
                    <a
                      className="short"
                      href={shortUrlPath(link.shortCode)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      /r/{link.shortCode}
                    </a>
                    <p className="long" title={link.longUrl}>
                      {link.longUrl}
                    </p>
                    <p className="meta">
                      {link.clicks} click ·{" "}
                      {new Date(link.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="actions">
                    <button type="button" className="ghost" onClick={() => copyShort(link)}>
                      {copiedId === link.id ? "Đã copy" : "Copy"}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => startEdit(link)}
                      disabled={actionBusy === link.id}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => handleDelete(link)}
                      disabled={actionBusy === link.id}
                    >
                      {actionBusy === link.id ? "…" : "Xoá"}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </main>

      <footer className="footer">
        <span>Shortly · DevOps final lab</span>
      </footer>
    </div>
  );
}
