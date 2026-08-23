"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { EmptyState, ErrorState } from "@/components";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface User {
  id: number;
  name: string;
  role: string;
  state_id: number | null;
}

interface Commodity {
  id: number;
  name: string;
  category: string;
}

interface Post {
  id: number;
  commodity_id: number;
  mandi_id: number | null;
  state_id: number;
  price: number;
  note: string | null;
  image_url: string | null;
  created_at: string | null;
}

/* ------------------------------------------------------------------ */
/*  FarmerConsole                                                      */
/* ------------------------------------------------------------------ */

export default function FarmerClient() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  // form state
  const [commodityId, setCommodityId] = useState<number | "">("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // login form
  const [loginName, setLoginName] = useState("");
  const [loginStateId, setLoginStateId] = useState<number | "">(3);

  /* ---- Load commodities on mount ---- */
  useEffect(() => {
    apiFetch<Commodity[]>("/api/commodities")
      .then(setCommodities)
      .catch(() => {});
  }, []);

  /* ---- Login handler ---- */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginName.trim()) return;
    try {
      const res = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          name: loginName.trim(),
          role: "farmer",
          state_id: loginStateId || null,
        }),
      });
      setUser(res.user);
      setToken(res.token);
    } catch {
      setError("Login failed");
    }
  }

  /* ---- Post handler ---- */
  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !token || !commodityId || !price) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const post = await apiFetch<Post>("/api/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          commodity_id: commodityId,
          price: parseFloat(price),
          note: note.trim() || null,
          state_id: user.state_id,
        }),
      });
      setPosts((prev) => [post, ...prev]);
      setPrice("");
      setNote("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to post");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- Not logged in ---- */
  if (!user) {
    return (
      <main className="max-w-content mx-auto px-4 py-6">
        <h1 className="text-[28px] font-semibold text-text mb-4">Farmer Console</h1>
        <form onSubmit={handleLogin} className="max-w-sm space-y-4">
          <div>
            <label className="block text-[13px] text-text-muted mb-1">Your name</label>
            <input
              type="text"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-card text-[14px] text-text"
              placeholder="e.g. Rahul"
              required
            />
          </div>
          <div>
            <label className="block text-[13px] text-text-muted mb-1">State ID</label>
            <input
              type="number"
              value={loginStateId}
              onChange={(e) => setLoginStateId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 bg-surface border border-border rounded-card text-[14px] text-text"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-brand text-white rounded-card text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            Sign in as Farmer
          </button>
        </form>
      </main>
    );
  }

  /* ---- Logged in ---- */
  return (
    <main className="max-w-content mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold text-text">Farmer Console</h1>
          <p className="text-[13px] text-text-muted">
            {user.name} &middot; {user.role}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setUser(null); setToken(null); setPosts([]); }}
          className="text-[13px] text-text-muted hover:text-text"
        >
          Sign out
        </button>
      </div>

      {/* Post form */}
      <form onSubmit={handlePost} className="bg-surface border border-border rounded-card p-4 mb-6 space-y-4">
        <h2 className="text-[14px] font-semibold text-text">Report a price</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] text-text-muted mb-1">Commodity</label>
            <select
              value={commodityId}
              onChange={(e) => setCommodityId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 bg-surface border border-border rounded-card text-[14px] text-text"
              required
            >
              <option value="">Select...</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] text-text-muted mb-1">Price (INR/quintal)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-card text-[14px] text-text tabular-nums"
              placeholder="e.g. 2350"
              min="1"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[13px] text-text-muted mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-card text-[14px] text-text"
            placeholder="e.g. gate rate today"
          />
        </div>

        {error && <p className="text-[13px] text-red-600">{error}</p>}
        {success && <p className="text-[13px] text-green-600">Posted successfully!</p>}

        <button
          type="submit"
          disabled={submitting || !commodityId || !price}
          className="px-6 py-2 bg-brand text-white rounded-card text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post Price"}
        </button>
      </form>

      {/* Recent posts */}
      <div className="bg-surface border border-border rounded-card p-4">
        <h2 className="text-[14px] font-semibold text-text mb-3">My Recent Posts</h2>
        {posts.length === 0 ? (
          <EmptyState
            icon={<PostIcon />}
            message="You haven't posted any prices yet"
          />
        ) : (
          <div className="space-y-3">
            {posts.map((p) => {
              const commodity = commodities.find((c) => c.id === p.commodity_id);
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <span className="text-[13px] font-medium text-text">{commodity?.name || `#${p.commodity_id}`}</span>
                    <span className="text-[12px] text-text-muted ml-2">{p.note}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[14px] font-semibold tabular-nums">₹{p.price.toLocaleString("en-IN")}</span>
                    <span className="text-[11px] text-text-muted block">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function PostIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
