"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Button } from "./ui/button";
import { Pricing } from "./pricing";
import { TIER_NAMES } from "@/lib/catalog";
import {
  Download,
  Trash2,
  ArrowUpRight,
  LogOut,
  Loader2,
  ShieldCheck,
} from "lucide-react";
async function request(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/" + path, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const d: any = await r.json();
  if (!r.ok)
    throw new Error(
      typeof d.error === "string"
        ? d.error
        : d.message || "Something went wrong. Please try again.",
    );
  return d;
}
export function Login() {
  const [cfg, setCfg] = useState<{ mock: boolean; google: boolean } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(location.search).has("error"))
      setError(
        "Google sign-in didn’t finish. Please try again. Your photos are saved in this browser.",
      );
    request("config")
      .then(setCfg)
      .catch(() => setError("Service is temporarily unavailable."));
  }, []);
  const next = () => {
    const n = new URLSearchParams(location.search).get("next") || "/#create";
    return n.startsWith("/") && !n.startsWith("//") && !n.includes("\\")
      ? n
      : "/#create";
  };
  async function login(mock: boolean, admin = false) {
    setBusy(true);
    try {
      if (mock) {
        await request("mock/signin", "POST", { admin });
        location.href = admin ? "/admin" : next();
      } else {
        const d = await request("auth/sign-in/social", "POST", {
          provider: "google",
          callbackURL: location.origin + next(),
          errorCallbackURL:
            location.origin + "/login?next=" + encodeURIComponent(next()),
        });
        if (d.url) location.href = d.url;
        else throw new Error("Google sign-in could not start.");
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="login-box studio-login">
      <a href="/" className="login-brand">
        <img src="/icon.svg" alt="Smalltown Boy AI" width={40} height={40} />
      </a>
      <h1>Sign in</h1>
      <p className="login-subtitle">Create and save your pet videos.</p>
      <Button
        variant="outline"
        disabled={busy || !cfg?.google}
        onClick={() => login(false)}
      >
        {busy ? (
          <>
            <Loader2 className="spin" size={17} />
            Connecting…
          </>
        ) : (
          <>
            Continue with Google <ArrowUpRight size={17} />
          </>
        )}
      </Button>
      {cfg && !cfg.google && (
        <p className="status-note">
          {cfg.mock
            ? "Google sign-in isn’t connected locally yet. You can try the demo below."
            : "Sign-in is temporarily unavailable. Please try again later."}
        </p>
      )}
      {cfg?.mock && (
        <>
          <Button disabled={busy} onClick={() => login(true)}>
            {busy ? (
              <Loader2 className="spin" size={17} />
            ) : (
              <>
                Explore with a test account <ArrowUpRight size={17} />
              </>
            )}
          </Button>
          <p className="status-note">
            Local demo only. Starts with 0 test credits. No real Google account
            or payment is used.
          </p>
          <button
            className="text-link"
            onClick={() => login(true, true)}
            disabled={busy}
          >
            Open admin demo
          </button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="fineprint">
        {cfg?.mock ? "Preview policies: " : "By continuing, you agree to our "}
        <Link href="/terms">Terms</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}
export function PricingPage() {
  const [mock, setMock] = useState(false);
  useEffect(() => {
    request("config").then((d) => setMock(d.mock));
  }, []);
  return <Pricing mock={mock} standalone />;
}
export function Checkout() {
  const [order, setOrder] = useState<{
    id: string;
    package_id: string;
    cents: number;
    credits: number;
    mode: string;
    status: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("order");
    if (id)
      request("orders/" + id)
        .then(setOrder)
        .catch((e) => setError(e.message));
    else setError("No order selected.");
  }, []);
  async function pay() {
    setBusy(true);
    try {
      await request("mock/pay", "POST", { orderId: order!.id });
      location.href = "/dashboard/billing";
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="login-box">
      <span className="eyebrow">LOCAL TEST CHECKOUT</span>
      <h1 style={{ marginTop: 15 }}>Try the credit flow.</h1>
      {order && (
        <>
          <p>
            {order.package_id.toUpperCase()} · {order.credits} test credits
          </p>
          <div className="price">${(order.cents / 100).toFixed(2)}</div>
          <p>
            This is a simulation. No card information is collected and you will
            not be charged.
          </p>
          <Button
            disabled={
              busy || order.mode !== "mock" || order.status !== "pending"
            }
            onClick={pay}
          >
            {busy
              ? "Confirming…"
              : order.status === "paid"
                ? "Already confirmed"
                : "Simulate successful payment"}
          </Button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Link className="watch-link" href="/pricing">
        Back to plans
      </Link>
    </div>
  );
}
type User = {
  id: string;
  name: string;
  role: string;
  wallet: { balance: number; reserved: number; tier: number };
};
type Video = {
  template_id?: string | null;
  id: string;
  status: string;
  resolution: string;
  provider: string;
  created_at: number;
  error_code: string | null;
};
export function Dashboard({ section = "overview" }: { section?: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [billing, setBilling] = useState<{
    orders: Record<string, string | number>[];
    transactions: Record<string, string | number>[];
  }>({ orders: [], transactions: [] });
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  async function refresh() {
    try {
      const u = await request("me");
      setUser(u);
      setVideos(await request("tasks"));
      if (section === "billing") setBilling(await request("billing"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => clearInterval(timer);
  }, [section]);
  async function remove(id: string) {
    if (!confirm("Delete this video permanently?")) return;
    try {
      await request("tasks/" + id, "DELETE");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!loaded) return <p>Loading your account…</p>;
  if (!user)
    return (
      <div className="empty-state">
        <h2>Your videos live here.</h2>
        <p>{error || "Sign in to see your account."}</p>
        <Link
          className="button button-primary"
          href={
            "/login?next=/dashboard/" + (section === "overview" ? "" : section)
          }
        >
          Sign in
        </Link>
      </div>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR LITTLE CREATIVE CORNER</span>
          <h1 style={{ marginTop: 12 }}>
            {section === "billing"
              ? "Credits & billing"
              : section === "videos"
                ? "My videos"
                : `Hello, ${user.name}.`}
          </h1>
          <p>Everything you need for your next double act.</p>
        </div>
        <button
          className="button button-outline button-small"
          onClick={async () => {
            await request("logout", "POST");
            location.href = "/";
          }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
      <nav className="dashboard-tabs">
        {[
          ["Overview", "/dashboard", "overview"],
          ["My Videos", "/dashboard/videos", "videos"],
          ["Billing", "/dashboard/billing", "billing"],
        ].map(([n, p, s]) => (
          <Link className={section === s ? "active" : ""} key={s} href={p}>
            {n}
          </Link>
        ))}
        {user.role === "admin" && <Link href="/admin">Admin</Link>}
      </nav>
      <div className="wallet-stats">
        <div className="stat">
          <span>Available credits</span>
          <strong>{user.wallet.balance}</strong>
        </div>
        <div className="stat">
          <span>Reserved credits</span>
          <strong>{user.wallet.reserved}</strong>
        </div>
        <div className="stat">
          <span>Resolution access</span>
          <strong>{TIER_NAMES[user.wallet.tier]}</strong>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 30 }}>
        <Link className="button button-primary" href="/#create">
          Create a video <ArrowUpRight size={16} />
        </Link>
        <Link className="button button-outline" href="/pricing">
          Buy credits
        </Link>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {section === "billing" ? (
        <>
          <h2>Orders</h2>
          <Table
            rows={billing.orders}
            columns={[
              "package_id",
              "cents",
              "credits",
              "status",
              "mode",
              "created_at",
            ]}
          />
          <h2 style={{ marginTop: 35 }}>Credit activity</h2>
          <Table
            rows={billing.transactions}
            columns={["kind", "delta", "reserved_delta", "created_at"]}
          />
        </>
      ) : videos.length ? (
        <div className="task-grid">
          {videos.map((v) => (
            <article className="task-card" key={v.id}>
              {v.status === "completed" ? (
                <video
                  controls
                  preload="none"
                  poster="/images/dance-preview.png"
                  src={"/api/tasks/" + v.id + "/video"}
                />
              ) : (
                <img
                  src="/images/dance-preview.png"
                  alt="Illustrative preview, not the task result"
                />
              )}
              <h3>
                {v.status === "completed"
                  ? "Ready for its close-up"
                  : v.status.replaceAll("_", " ")}
              </h3>
              <p>
                {v.template_id
                  ? `${v.template_id === "living-room" ? "Living room" : v.template_id === "red-fence" ? "Red fence" : v.template_id} · `
                  : ""}
                {v.resolution}{" "}
                {v.provider === "mock"
                  ? "requested · test clip is 480 × 854, 3s"
                  : ""}
                <br />
                {new Date(v.created_at).toLocaleString()}
              </p>
              <p>
                Task {v.id.slice(0, 8)}
                {v.error_code ? " · " + v.error_code : ""}
              </p>
              <div className="task-actions">
                {v.status === "completed" && (
                  <a
                    className="button button-outline button-small"
                    href={"/api/tasks/" + v.id + "/video?download=1"}
                  >
                    <Download size={14} />
                    Download
                  </a>
                )}
                {["completed", "failed"].includes(v.status) && (
                  <button
                    className="button button-ghost button-small"
                    aria-label="Delete video"
                    onClick={() => remove(v.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No dance breaks just yet.</h2>
          <p>Your completed videos and active tasks will appear here.</p>
          <Link className="button button-outline" href="/#create">
            Meet the generator <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
    </>
  );
}
export function Table({
  rows,
  columns,
}: {
  rows: Record<string, unknown>[];
  columns: string[];
}) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c.replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c}>
                  {c === "created_at"
                    ? new Date(Number(row[c])).toLocaleString()
                    : c === "cents"
                      ? "$" + (Number(row[c]) / 100).toFixed(2)
                      : String(row[c] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p style={{ padding: "20px 0", fontSize: 13 }}>Nothing here yet.</p>
  );
}
function CreditGrantForm({ onGranted }: { onGranted: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const submitting = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget,
      values = new FormData(form);
    const payload = {
      email: String(values.get("email")).trim(),
      credits: Number(values.get("credits")),
      tier: Number(values.get("tier")),
      reason: String(values.get("reason")).trim(),
    };
    const body = JSON.stringify(payload);
    if (attempt.current?.body !== body)
      attempt.current = { body, key: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await request("admin/credits", "POST", {
        ...payload,
        key: attempt.current.key,
      });
      setSuccess(
        `${result.email}: added ${result.credits} credits. Balance: ${result.wallet.balance}; reserved: ${result.wallet.reserved}. Reference: ${result.id}`,
      );
      form.reset();
      attempt.current = null;
      await onGranted();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="admin-section">
      <h2>Grant test credits</h2>
      <p>
        Grant credits to a registered account without a payment. Live video
        generation and safety checks still incur provider charges.
      </p>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Recipient email
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            placeholder="Your signed-in account email"
          />
        </label>
        <label>
          Credits
          <input
            name="credits"
            type="number"
            min={1}
            max={10000}
            step={1}
            defaultValue={600}
            required
          />
        </label>
        <label>
          Resolution access
          <select name="tier" defaultValue="3">
            <option value="1">480p</option>
            <option value="2">Up to 768p</option>
            <option value="3">Up to 1080p</option>
          </select>
        </label>
        <label>
          Reason
          <textarea
            name="reason"
            required
            minLength={5}
            maxLength={500}
            placeholder="Internal generation testing"
          />
        </label>
        <Button disabled={busy}>
          {busy ? "Granting…" : "Grant credits and record action"}
        </Button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
    </section>
  );
}
export function Admin() {
  const [data, setData] = useState<Record<
    string,
    Record<string, unknown>[]
  > | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setData(await request("admin"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await request("admin/action", "POST", {
        action: form.get("action"),
        target: form.get("target"),
        reason: form.get("reason"),
        ...(form.get("credits")
          ? { credits: Number(form.get("credits")) }
          : {}),
        ...(form.get("actualCost")
          ? { actualCost: Number(form.get("actualCost")) }
          : {}),
        ...(form.get("outputDuration")
          ? { outputDuration: Number(form.get("outputDuration")) }
          : {}),
        key: crypto.randomUUID(),
      });
      setStatus("Action recorded in the audit log.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERATIONS</span>
          <h1>Admin workspace</h1>
        </div>
        <ShieldCheck size={28} />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <Link className="button button-outline" href="/login">
          Sign in with an administrator account
        </Link>
      ) : (
        <>
          <CreditGrantForm onGranted={load} />
          <section className="admin-section">
            <h2>Audited actions</h2>
            <form className="form-stack" onSubmit={submit}>
              <label>
                Action
                <select name="action">
                  <option value="pause">Pause generation</option>
                  <option value="resume">Resume generation</option>
                  <option value="compensate">Compensate credits</option>
                  <option value="approve-input">Approve pet image</option>
                  <option value="reject-input">Reject image</option>
                  <option value="approve-output">
                    Approve generated video
                  </option>
                  <option value="reject-output">
                    Reject generated video & release credits
                  </option>
                  <option value="reverse-order">
                    Reconcile confirmed full refund / chargeback
                  </option>
                  <option value="record-cost">
                    Record actual provider cost and output duration
                  </option>
                  <option value="release-unknown">
                    Release uncertain task after provider reconciliation
                  </option>
                </select>
              </label>
              <label>
                Target user, media or task ID (use “service” for pause/resume)
                <input name="target" required />
              </label>
              <label>
                Credits (compensation only)
                <input name="credits" type="number" min="1" max="10000" />
              </label>
              <label>
                Actual provider cost (integer USD cents)
                <input name="actualCost" type="number" min="0" max="100000" />
              </label>
              <label>
                Measured output duration (seconds)
                <input
                  name="outputDuration"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="60"
                />
              </label>
              <label>
                Reason / reconciliation evidence
                <textarea name="reason" required minLength={5} />
              </label>
              <Button disabled={busy}>Apply and record action</Button>
            </form>
            {status && <p role="status">{status}</p>}
          </section>
          <section className="admin-section">
            <h2>Service settings</h2>
            <Table rows={data.settings || []} columns={["key", "value"]} />
          </section>
          {[
            ["Users", "user", ["id", "name", "email", "role"]],
            [
              "Manual credit grants",
              "admin_credit_grants",
              [
                "id",
                "user_id",
                "credits",
                "tier",
                "reason",
                "admin_id",
                "created_at",
              ],
            ],
            [
              "Orders",
              "payment_orders",
              ["id", "user_id", "package_id", "status", "cents"],
            ],
            [
              "Credits",
              "credit_transactions",
              ["user_id", "kind", "delta", "reserved_delta", "created_at"],
            ],
            [
              "Video tasks & costs",
              "video_tasks",
              [
                "id",
                "status",
                "model",
                "resolution",
                "estimated_cost",
                "actual_cost",
                "error_code",
              ],
            ],
            [
              "Media review",
              "media_assets",
              ["id", "user_id", "moderation", "mime"],
            ],
            [
              "Audit log",
              "admin_audit_logs",
              ["admin_id", "action", "target", "reason", "created_at"],
            ],
          ].map(([title, key, cols]) => (
            <section className="admin-section" key={String(key)}>
              <h2>{String(title)}</h2>
              <Table
                rows={data[String(key)] || []}
                columns={cols as string[]}
              />
              {key === "media_assets" && (
                <div className="task-grid">
                  {(data.media_assets || [])
                    .filter((a) => a.moderation === "pending")
                    .map((a) => (
                      <div key={String(a.id)} className="task-card">
                        <img
                          src={"/api/media/" + a.id}
                          alt="Uploaded image awaiting moderation"
                        />
                        <p>{String(a.id)}</p>
                      </div>
                    ))}
                </div>
              )}
              {key === "video_tasks" && (
                <div className="task-grid">
                  {(data.video_tasks || [])
                    .filter((t) => t.status === "review")
                    .map((t) => (
                      <div key={String(t.id)} className="task-card">
                        <video controls src={"/api/admin/video/" + t.id} />
                        <p>{String(t.id)}</p>
                      </div>
                    ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </>
  );
}
