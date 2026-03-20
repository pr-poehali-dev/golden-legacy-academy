import { useState, useRef, useEffect } from "react";

const CONTENT_URL = "https://functions.poehali.dev/bf7c083b-57bf-4121-96e6-d4cf21b4b436";
const TOKEN_KEY = "gn_session_token";

// ─── Глобальный стор контента ─────────────────────────────────────────────────
type ContentStore = Record<string, string>;
type Listener = () => void;

class ContentManager {
  private store: ContentStore = {};
  private listeners: Set<Listener> = new Set();
  private loaded = false;
  private loading = false;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  getAll(): ContentStore {
    return this.store;
  }

  get(key: string, fallback = ""): string {
    return this.store[key] ?? fallback;
  }

  set(key: string, value: string) {
    this.store = { ...this.store, [key]: value };
    this.notify();
  }

  async load() {
    if (this.loaded || this.loading) return;
    this.loading = true;
    try {
      const res = await fetch(`${CONTENT_URL}?action=all`);
      if (res.ok) {
        const data = await res.json();
        this.store = data.content || {};
        this.loaded = true;
        this.notify();
      }
    } finally {
      this.loading = false;
    }
  }

  async save(key: string, value: string): Promise<boolean> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;
    const res = await fetch(`${CONTENT_URL}?action=save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": token },
      body: JSON.stringify({ key, value }),
    });
    if (res.ok) {
      this.set(key, value);
      return true;
    }
    return false;
  }
}

export const contentManager = new ContentManager();

// ─── Hook для использования контента ─────────────────────────────────────────
export function useContent() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsub = contentManager.subscribe(() => forceUpdate((n) => n + 1));
    contentManager.load();
    return unsub;
  }, []);

  return {
    get: (key: string, fallback = "") => contentManager.get(key, fallback),
  };
}

// ─── Компонент редактируемого текста ─────────────────────────────────────────
interface EditableTextProps {
  contentKey: string;
  fallback: string;
  isAdmin: boolean;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div" | "button";
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  onClick?: () => void;
}

export default function EditableText({
  contentKey,
  fallback,
  isAdmin,
  as: Tag = "span",
  className = "",
  style,
  multiline = false,
  onClick,
}: EditableTextProps) {
  const [value, setValue] = useState(() => contentManager.get(contentKey, fallback));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Синхронизация с глобальным стором
  useEffect(() => {
    const unsub = contentManager.subscribe(() => {
      const newVal = contentManager.get(contentKey, fallback);
      setValue(newVal);
    });
    return unsub;
  }, [contentKey, fallback]);

  // Фокус при открытии
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      const len = draft.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleClick = (e: React.MouseEvent) => {
    if (isAdmin) {
      e.stopPropagation();
      setDraft(value);
      setEditing(true);
    } else if (onClick) {
      onClick();
    }
  };

  const handleSave = async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    const ok = await contentManager.save(contentKey, draft);
    if (ok) setValue(draft);
    setSaving(false);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setEditing(false); return; }
    if (!multiline && e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (multiline && e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSave();
  };

  if (editing) {
    return (
      <span className="relative inline-block" style={{ minWidth: 80 }}>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className="w-full bg-background border rounded px-2 py-1 font-body text-sm text-foreground focus:outline-none resize-none"
            style={{ borderColor: "hsl(45,70%,45%)", minWidth: 200, boxShadow: "0 0 12px rgba(180,140,30,0.25)" }}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-background border rounded px-2 py-1 font-body text-sm text-foreground focus:outline-none"
            style={{ borderColor: "hsl(45,70%,45%)", minWidth: 120, width: Math.max(120, draft.length * 10), boxShadow: "0 0 12px rgba(180,140,30,0.25)" }}
          />
        )}
        <span className="flex gap-1 mt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="font-body text-[10px] px-2 py-0.5 rounded"
            style={{ background: "hsl(45,80%,50%)", color: "hsl(150,20%,6%)" }}
          >
            {saving ? "..." : "✓"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="font-body text-[10px] px-2 py-0.5 rounded border border-border/50 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </span>
      </span>
    );
  }

  return (
    <Tag
      className={`${className} ${isAdmin ? "cursor-pointer relative group/editable" : ""}`}
      style={style}
      onClick={isAdmin ? handleClick : onClick}
    >
      {value || fallback}
      {isAdmin && (
        <span
          className="absolute -top-1 -right-1 opacity-0 group-hover/editable:opacity-100 transition-opacity z-10 pointer-events-none"
          style={{
            background: "hsl(45,80%,50%)",
            color: "hsl(150,20%,6%)",
            fontSize: 9,
            padding: "1px 5px",
            borderRadius: 3,
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          ✏ править
        </span>
      )}
    </Tag>
  );
}
