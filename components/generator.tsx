"use client";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Plus,
  Music2,
  PawPrint,
  X,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Loader2,
  Download,
  AlertCircle,
} from "lucide-react";
import { TemplatePicker } from "./template-picker";
import { Button } from "./ui/button";
import { SPECS, type Resolution } from "@/lib/catalog";
import type { PublicTemplate } from "@/lib/templates";
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
    throw Object.assign(
      new Error(d.error || "Something went wrong. Please try again."),
      { code: d.code },
    );
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
  const [templateId, setTemplateId] = useState("living-room");
  const [resolution, setResolution] = useState<Resolution>("480p");
  const [user, setUser] = useState<{
    wallet: { balance: number; tier: number };
  } | null>(null);
  const [config, setConfig] = useState({
    mock: false,
    generation: false,
    resolutions: [] as string[],
    templates: [] as PublicTemplate[],
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
      .then((c) => {
        setConfig(c);
        const saved = localStorage.getItem("smalltown-template");
        const available = c.templates.filter(
          (t: PublicTemplate) => t.available,
        );
        setTemplateId(
          available.find((t: PublicTemplate) => t.id === saved)?.id ||
            available[0]?.id ||
            c.templates[0]?.id ||
            "living-room",
        );
        const savedResolution = localStorage.getItem(
          "smalltown-resolution",
        ) as Resolution | null;
        if (
          savedResolution &&
          Object.hasOwn(SPECS, savedResolution) &&
          (c.mock || c.resolutions.includes(savedResolution))
        )
          setResolution(savedResolution);
        else if (!c.mock && c.resolutions.length)
          setResolution(c.resolutions[0]);
      })
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
    if (!task || ["completed", "failed", "unknown"].includes(task.status))
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
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setMessage("Choose a JPG or PNG image under 8 MB.");
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
  const [checkingInputs, setCheckingInputs] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function generate() {
    setMessage("");
    if (!user) {
      location.href = "/login?next=" + encodeURIComponent("/#create");
      return;
    }
    if (
      !config.mock &&
      (!config.generation ||
        !config.resolutions.includes(resolution) ||
        !config.templates.some((t) => t.id === templateId && t.available))
    ) {
      setMessage(
        "This template and resolution are not available for generation yet.",
      );
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
        const d: any = await r.json().catch(() => ({
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
      const payload = {
        assetA: ids[0],
        assetB: ids[1],
        resolution,
        templateId,
        requestKey: key.current,
        consent: true,
      };
      let t: Task | undefined;
      for (let attempt = 0; attempt < 40; attempt++) {
        try {
          t = await api("tasks", payload);
          break;
        } catch (error) {
          if ((error as { code?: string }).code !== "SAFETY_PENDING")
            throw error;
          setCheckingInputs(true);
          setMessage(
            "Checking your photos automatically. Generation will start when checks pass.",
          );
          await new Promise((resolve) => setTimeout(resolve, 30000));
          if (!mounted.current) return;
        }
      }
      if (!t)
        throw new Error(
          "Safety checks are taking longer than expected. Please try again later; no generation credits were charged.",
        );
      setCheckingInputs(false);
      setMessage("");
      setTask(t);
      localStorage.setItem("smalltown-task", t.id);
      await api("me").then((u) => {
        setUser(u);
        window.dispatchEvent(new Event("wallet-updated"));
      });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setCheckingInputs(false);
      setBusy("");
    }
  }
  const active = task && !["completed", "failed"].includes(task.status);
  useEffect(() => {
    const select = (event: Event) => {
      const id = (event as CustomEvent).detail;
      if (!active && !busy && config.templates.some((t) => t.id === id)) {
        setTemplateId(id);
        localStorage.setItem("smalltown-template", id);
        key.current = null;
      }
    };
    window.addEventListener("smalltown-template-selected", select);
    return () =>
      window.removeEventListener("smalltown-template-selected", select);
  }, [active, busy, config.templates]);
  const selectedTemplate = config.templates.find((t) => t.id === templateId);
  return (
    <section id="create" className="studio-create">
      <div className="studio-heading">
        <div>
          <span className="studio-kicker">01 / MAKE IT THEIRS</span>
          <h2>Cast your dancing duo.</h2>
          <p>One photo for each pet. We’ll take care of the moves.</p>
        </div>
        <span className="studio-format">
          14 SEC <span>/</span> 9:16
        </span>
      </div>
      <div className="studio-workbench">
        <div className="studio-upload-area">
          <div className="studio-uploads">
            {[0, 1].map((i) => (
              <div className="pet-upload-card" key={i}>
                <div className="pet-card-heading">
                  <label htmlFor={"character-" + i}>
                    <span>0{i + 1}</span> CHARACTER {i === 0 ? "A" : "B"}
                  </label>
                  <small>{i === 0 ? "Foreground" : "Background"}</small>
                </div>
                <div
                  className={"pet-dropzone " + (photos[i] ? "has-photo" : "")}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!busy && !active) choose(i, e.dataTransfer.files[0]);
                  }}
                >
                  {photos[i] ? (
                    <>
                      <img
                        src={photos[i]!.url}
                        alt={"Your character " + (i === 0 ? "A" : "B")}
                      />
                      <button
                        type="button"
                        className="pet-remove"
                        aria-label={"Remove character " + (i === 0 ? "A" : "B")}
                        disabled={!!busy || !!active}
                        onClick={() => {
                          setPhotos((p) =>
                            p.map((v, n) => (n === i ? null : v)),
                          );
                          clearDraft(String(i));
                          key.current = null;
                        }}
                      >
                        <X size={17} />
                      </button>
                      <button
                        type="button"
                        className="pet-change"
                        disabled={!!busy || !!active}
                        onClick={() => inputs[i].current?.click()}
                      >
                        <Upload size={15} />
                        Change photo
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="pet-upload-empty"
                      disabled={!!busy || !!active}
                      onClick={() => inputs[i].current?.click()}
                    >
                      <span className="upload-plus">
                        <Plus size={25} />
                      </span>
                      <strong>Drop a photo here</strong>
                      <span>or browse your files</span>
                      <small>
                        JPG or PNG · up to 8 MB · 280 × 280 px recommended
                        minimum
                      </small>
                    </button>
                  )}
                  <input
                    id={"character-" + i}
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png"
                    ref={inputs[i]}
                    disabled={!!busy || !!active}
                    onChange={(e) => choose(i, e.target.files?.[0])}
                  />
                </div>
                <p>
                  {i === 0
                    ? "The close-up. The big reaction."
                    : "The moves. The scene-stealer."}
                </p>
              </div>
            ))}
            <div className="duo-sync" aria-hidden="true">
              <Music2 size={21} />
            </div>
          </div>
          <div className="studio-upload-footer">
            <span>
              <ShieldCheck size={15} />
              Your photos stay private.
            </span>
            <button
              type="button"
              onClick={samples}
              disabled={!!busy || !!active}
            >
              Try sample photos <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        <aside className="studio-settings" aria-label="Video settings">
          <TemplatePicker
            templates={config.templates}
            selectedId={templateId}
            disabled={!!busy || !!active}
            onSelect={(id) => {
              setTemplateId(id);
              localStorage.setItem("smalltown-template", id);
              key.current = null;
            }}
          />
          <fieldset className="studio-quality">
            <legend className="studio-kicker">VIDEO QUALITY</legend>
            <div className="quality-options">
              {(Object.keys(SPECS) as Resolution[]).map((r) => (
                <button
                  type="button"
                  key={r}
                  aria-pressed={resolution === r}
                  disabled={
                    !!busy ||
                    !!active ||
                    (!config.mock && !config.resolutions.includes(r))
                  }
                  className={resolution === r ? "selected" : ""}
                  onClick={() => {
                    setResolution(r);
                    localStorage.setItem("smalltown-resolution", r);
                    key.current = null;
                  }}
                >
                  <strong>{r}</strong>
                  <span>{SPECS[r].credits} credits</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="studio-subject">
            <span className="studio-kicker">CAST</span>
            <span>
              <PawPrint size={17} />
              Pet duo
            </span>
          </div>
          <div className="studio-cost">
            <span>This video</span>
            <strong>
              {SPECS[resolution].credits} <small>credits</small>
            </strong>
          </div>
          <div className="studio-balance">
            <span>Your balance</span>
            <span>
              {user ? `${user.wallet.balance} credits` : "Sign in to view"}
            </span>
          </div>
          <label className="studio-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I own these photos or have permission to use them. Pets and
              fictional nonhuman characters only. Live generation uses SeeAPI
              safety checks; see our <a href="/privacy">Privacy Policy</a>.
            </span>
          </label>
          <Button
            className="studio-generate"
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
          <p className="studio-service-note">
            {config.mock
              ? "Local demo · no payment or AI call"
              : config.generation && selectedTemplate?.available
                ? "14-second MP4 · template audio included"
                : "Live generation is coming soon."}
          </p>
          {message && (
            <div
              className={checkingInputs ? "status-note" : "error"}
              role={checkingInputs ? "status" : "alert"}
            >
              {checkingInputs ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <AlertCircle size={16} />
              )}
              {message}
            </div>
          )}
        </aside>
      </div>
      {task && (
        <div className="studio-result" aria-live="polite">
          <div className="studio-result-media">
            {task.status === "completed" ? (
              <video
                controls
                playsInline
                src={"/api/tasks/" + task.id + "/video"}
              />
            ) : (
              <div className="studio-progress">
                <Loader2
                  className={task.status === "failed" ? "" : "spin"}
                  size={34}
                />
                <span>
                  {task.status === "failed"
                    ? "This one missed a beat"
                    : task.status === "review"
                      ? "Checking your video"
                      : task.status === "unknown"
                        ? "Checking your submission"
                        : "Your duo is taking shape"}
                </span>
              </div>
            )}
          </div>
          <div>
            <span className="studio-kicker">YOUR CREATION</span>
            <h3>
              {task.status === "completed"
                ? "Ready for its close-up."
                : "A little dance in the making."}
            </h3>
            <p>
              {task.status === "failed"
                ? "Reserved credits have been returned."
                : task.status === "completed"
                  ? config.mock
                    ? "Test animation · 480 × 854 · 3 seconds"
                    : "Your private video is ready to download."
                  : task.status === "review"
                    ? task.error_code === "SAFETY_BLOCKED"
                      ? "Safety checks flagged this video. It remains private; contact support for review."
                      : task.error_code === "SAFETY_UNAVAILABLE"
                        ? "Safety checks could not finish. Your video remains private; contact support for review."
                        : "Checking your video automatically. It will be ready to download when checks pass."
                    : "Your task is saved. You can check back in My Videos."}
            </p>
            <small>
              Task {task.id.slice(0, 8)} · {task.resolution}
              {config.mock ? " requested" : ""}
            </small>
            {task.status === "completed" && (
              <a
                className="button button-primary"
                href={"/api/tasks/" + task.id + "/video?download=1"}
              >
                <Download size={17} />
                Download {config.mock ? "test MP4" : "MP4"}
              </a>
            )}
            {["completed", "failed"].includes(task.status) && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setTask(null);
                  key.current = null;
                  localStorage.removeItem("smalltown-task");
                }}
              >
                Create another video <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
