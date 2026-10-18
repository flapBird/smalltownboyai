"use client";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  X,
  Sparkles,
  ArrowUpRight,
  ImagePlus,
  ShieldCheck,
  Play,
  Loader2,
  Download,
  CircleCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { SPECS, type Resolution } from "@/lib/catalog";
type Photo = { url: string; id?: string; sample?: boolean };
type Task = {
  id: string;
  status: string;
  resolution: string;
  error_code?: string;
  output_key?: string;
};
async function api(path: string, body?: unknown) {
  const r = await fetch(
    "/api/" + path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const d: any = await r.json();
  if (!r.ok)
    throw new Error(d.error || "Something went wrong. Please try again.");
  return d;
}
const saveDraft = (key: string, file: File) =>
  new Promise<void>((resolve, reject) => {
    const req = indexedDB.open("smalltown-drafts", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("photos");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("photos", "readwrite");
      tx.objectStore("photos").put(file, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
function restoreDraft(key: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const req = indexedDB.open("smalltown-drafts", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("photos");
    req.onerror = () => resolve(undefined);
    req.onsuccess = () => {
      const db = req.result;
      const read = db.transaction("photos").objectStore("photos").get(key);
      read.onsuccess = () => {
        resolve(read.result);
        db.close();
      };
      read.onerror = () => {
        resolve(undefined);
        db.close();
      };
    };
  });
}
async function clearDraft(key: string) {
  const req = indexedDB.open("smalltown-drafts", 1);
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").delete(key);
    tx.oncomplete = () => db.close();
  };
}
export function Generator() {
  const [photos, setPhotos] = useState<(Photo | null)[]>([null, null]);
  const [resolution, setResolution] = useState<Resolution>("480p");
  const [user, setUser] = useState<{
    wallet: { balance: number; tier: number };
  } | null>(null);
  const [config, setConfig] = useState({
    mock: false,
    generation: false,
    resolutions: [] as string[],
  });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const [consent, setConsent] = useState(false);
  const inputs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const key = useRef<string | null>(null);
  useEffect(() => {
    api("config")
      .then(setConfig)
      .catch(() => {});
    api("me")
      .then(setUser)
      .catch(() => {});
    for (let i = 0; i < 2; i++)
      restoreDraft(String(i)).then((f) => {
        if (f)
          setPhotos((p) =>
            p.map((v, n) => (n === i ? { url: URL.createObjectURL(f) } : v)),
          );
      });
    const id = localStorage.getItem("smalltown-task");
    if (id)
      api("tasks/" + id)
        .then(setTask)
        .catch(() => localStorage.removeItem("smalltown-task"));
  }, []);
  useEffect(() => {
    if (
      !task ||
      ["completed", "failed", "review", "unknown"].includes(task.status)
    )
      return;
    const timer = setInterval(
      () =>
        api("tasks/" + task.id)
          .then((t) => {
            setTask(t);
            if (t.status === "completed" || t.status === "failed")
              api("me").then((u) => {
                setUser(u);
                window.dispatchEvent(new Event("wallet-updated"));
              });
          })
          .catch((e) => setMessage(e.message)),
      3000,
    );
    return () => clearInterval(timer);
  }, [task?.id, task?.status]);
  async function choose(i: number, file?: File) {
    if (!file) return;
    setMessage("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setMessage("Choose a JPG, PNG or WebP image under 8 MB.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const valid =
        bitmap.width >= 256 &&
        bitmap.height >= 256 &&
        bitmap.width <= 4096 &&
        bitmap.height <= 4096;
      bitmap.close();
      if (!valid)
        throw new Error("Use an image between 256 and 4096 pixels per side.");
      await saveDraft(String(i), file);
      setPhotos((p) =>
        p.map((v, n) => (n === i ? { url: URL.createObjectURL(file) } : v)),
      );
      key.current = null;
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function samples() {
    setBusy("samples");
    try {
      for (const i of [0, 1]) {
        const r = await fetch(
          "/images/character-" + (i === 0 ? "a" : "b") + ".png",
        );
        await choose(
          i,
          new File([await r.blob()], `sample-${i}.png`, { type: "image/png" }),
        );
      }
    } finally {
      setBusy("");
    }
  }
  async function generate() {
    setMessage("");
    if (!user) {
      location.href = "/login?next=" + encodeURIComponent("/#create");
      return;
    }
    if (!photos[0] || !photos[1]) {
      setMessage("Add a photo for each character first.");
      return;
    }
    if (!consent) {
      setMessage("Please confirm you have permission to use both images.");
      return;
    }
    if (user.wallet.balance < SPECS[resolution].credits) {
      location.href = "/pricing";
      return;
    }
    setBusy("generate");
    try {
      const ids: string[] = [];
      for (let i = 0; i < 2; i++) {
        if (photos[i]?.id) {
          ids.push(photos[i]!.id!);
          continue;
        }
        const f = await restoreDraft(String(i));
        if (!f) throw new Error("Please select your photos again.");
        const body = new FormData();
        body.append("file", f);
        const r = await fetch("/api/uploads", { method: "POST", body });
        const d: any = await r
          .json()
          .catch(() => ({
            error:
              r.status === 413
                ? "Image is too large. Use a file under 8 MB."
                : "Upload failed. Please try again.",
          }));
        if (!r.ok) throw new Error(d.error);
        ids.push(d.id);
        setPhotos((p) =>
          p.map((v, n) => (n === i && v ? { ...v, id: d.id } : v)),
        );
      }
      key.current ??= crypto.randomUUID();
      const t = await api("tasks", {
        assetA: ids[0],
        assetB: ids[1],
        resolution,
        requestKey: key.current,
        consent: true,
      });
      setTask(t);
      localStorage.setItem("smalltown-task", t.id);
      await api("me").then((u) => {
        setUser(u);
        window.dispatchEvent(new Event("wallet-updated"));
      });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const active = task && !["completed", "failed"].includes(task.status);
  return (
    <section id="create" className="creator">
      <div className="generator-panel">
        <div className="step-title">
          <span className="step-number">1</span>
          <div>
            <h2>Upload your two characters</h2>
            <p>A great duo starts with two great photos.</p>
          </div>
        </div>
        <div className="upload-grid">
          {[0, 1].map((i) => (
            <div className="upload-field" key={i}>
              <label htmlFor={"character-" + i}>
                Character {i === 0 ? "A" : "B"}
              </label>
              <div
                className={"upload-box " + (photos[i] ? "has-photo" : "")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  choose(i, e.dataTransfer.files[0]);
                }}
              >
                {photos[i] ? (
                  <>
                    <img
                      src={photos[i]!.url}
                      alt={"Your character " + (i === 0 ? "A" : "B")}
                    />
                    <button
                      className="remove-photo"
                      aria-label={"Remove character " + (i === 0 ? "A" : "B")}
                      onClick={() => {
                        setPhotos((p) => p.map((v, n) => (n === i ? null : v)));
                        clearDraft(String(i));
                        key.current = null;
                      }}
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <button
                    className="upload-empty"
                    onClick={() => inputs[i].current?.click()}
                  >
                    <ImagePlus size={32} strokeWidth={1.3} />
                    <span>Add your pet photo</span>
                    <small>or drop it here</small>
                  </button>
                )}
                <button
                  className="upload-action"
                  onClick={() => inputs[i].current?.click()}
                >
                  <Upload size={15} />
                  {photos[i] ? "Change image" : "Upload image"}
                </button>
              </div>
              <input
                id={"character-" + i}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                ref={inputs[i]}
                onChange={(e) => choose(i, e.target.files?.[0])}
              />
            </div>
          ))}
        </div>
        <div className="upload-hint">
          <span>JPG, PNG, WebP · Max 8 MB each</span>
          <button onClick={samples} disabled={!!busy}>
            Try sample photos <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="generator-divider" />
        <div className="step-title settings-title">
          <span className="step-number">2</span>
          <h2>Make it your own</h2>
        </div>
        <div className="settings-grid">
          <fieldset>
            <legend>Resolution</legend>
            <div className="resolution-options">
              {(Object.keys(SPECS) as Resolution[]).map((r) => (
                <button
                  type="button"
                  key={r}
                  disabled={!config.mock && !config.resolutions.includes(r)}
                  className={r === resolution ? "selected" : ""}
                  aria-pressed={r === resolution}
                  onClick={() => {
                    setResolution(r);
                    key.current = null;
                  }}
                >
                  <span className="radio-indicator" />
                  {r}
                </button>
              ))}
            </div>
            <p className="field-note">
              {config.mock
                ? "Test mode · simulated specifications"
                : "Final specifications pending validation"}
            </p>
          </fieldset>
          <div className="credit-settings">
            <div>
              <span>Credits required</span>
              <strong>
                {SPECS[resolution].credits} <small>credits</small>
              </strong>
            </div>
            <div>
              <span>Current balance</span>
              <strong>
                {user ? user.wallet.balance : "—"}{" "}
                <small>{user ? "credits" : "Sign in to view"}</small>
              </strong>
            </div>
          </div>
        </div>
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I own these images or have permission to use them. Pets and
            fictional characters only.
          </span>
        </label>
        <Button
          className="generate-button"
          onClick={generate}
          disabled={!!busy || !!active}
        >
          {busy === "generate" ? (
            <>
              <Loader2 className="spin" size={18} />
              Preparing your duo…
            </>
          ) : active ? (
            <>
              <Loader2 className="spin" size={18} />
              Task {task.status}
            </>
          ) : (
            <>
              <Sparkles size={18} />
              {!user
                ? "Sign in to create your video"
                : user.wallet.balance < SPECS[resolution].credits
                  ? "Buy credits to create"
                  : "Create Your AI Video"}
              <ArrowUpRight size={17} />
            </>
          )}
        </Button>
        <a href="#examples" className="watch-link">
          <Play size={15} />
          Watch Examples
        </a>
        <p className="security-note">
          <ShieldCheck size={13} />
          {config.mock
            ? "Local demo · no real payment or AI call"
            : "Private uploads. Made for pets, not people."}
        </p>
        {message && (
          <div className="error" role="alert">
            <AlertCircle size={16} />
            {message}
          </div>
        )}
      </div>
      <div className="preview-column">
        <div className="video-preview">
          {task?.status === "completed" ? (
            <video
              controls
              playsInline
              src={"/api/tasks/" + task.id + "/video"}
              poster="/images/dance-preview.png"
            />
          ) : (
            <img
              className="dance-image"
              src="/images/dance-preview.png"
              alt="Concept illustration of a tabby and a white cat dancing under warm streetlights"
            />
          )}
          <span className="aspect-tag">9:16</span>
          {!task && (
            <div className="preview-bottom">
              <span className="illustrative-label">
                Illustrative preview · not a generated video
              </span>
              <div className="preview-caption">
                <Sparkles size={16} />
                <span>Two personalities. One dance floor.</span>
              </div>
            </div>
          )}
          {task && task.status !== "completed" && (
            <div className="task-overlay">
              <Loader2 className={task.status === "failed" ? "" : "spin"} />
              <h3>
                {task.status === "failed"
                  ? "This one missed a beat"
                  : task.status === "review"
                    ? "Ready for review"
                    : task.status === "unknown"
                      ? "Checking your submission"
                      : "Your duo is taking shape"}
              </h3>
              <p>
                {task.status === "failed"
                  ? "Reserved credits have been returned."
                  : task.status === "review"
                    ? "Your video is awaiting content review."
                    : "You can leave this page. Your task is saved in My Videos."}
              </p>
              <small>Task {task.id.slice(0, 8)}</small>
            </div>
          )}
        </div>
        {task?.status === "completed" ? (
          <div className="result-info">
            <p>
              <CircleCheck size={16} />{" "}
              {config.mock
                ? "Test animation complete · 480 × 854 · 3s"
                : "Video complete"}
              {!config.mock ? " · " + task.resolution : ""}
            </p>
            <a
              className="button button-outline"
              href={"/api/tasks/" + task.id + "/video?download=1"}
            >
              <Download size={16} />
              Download {config.mock ? "test MP4" : "MP4"}
            </a>
            <button
              className="text-link"
              onClick={() => {
                setTask(null);
                key.current = null;
                localStorage.removeItem("smalltown-task");
              }}
            >
              Create another video
            </button>
          </div>
        ) : (
          <p className="preview-note">
            <span className="tiny-dot" />A preview of the idea. Your pets bring
            the personality.
          </p>
        )}
        <div className="preview-meta">
          <span>ONE PHOTO PER CHARACTER</span>
          <span>MADE FOR VERTICAL VIDEO</span>
        </div>
      </div>
    </section>
  );
}
