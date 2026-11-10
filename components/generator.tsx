"use client";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Plus,
  Music2,
  PawPrint,
  Users,
  X,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Loader2,
  Download,
  Check,
  Film,
  Play,
  AlertCircle,
} from "lucide-react";
import {
  PENDING_GENERATION_KEY,
  readPendingGeneration,
  type PendingGeneration,
} from "@/lib/generation-draft";
import { readApiResponse } from "@/lib/client-response";
import { normalizePhoto } from "@/lib/normalize-photo";
import { TemplatePicker } from "./template-picker";
import { Button } from "./ui/button";
import {
  ACTIVE_TASK_LIMIT,
  SPECS,
  currentResolution,
  type Resolution,
} from "@/lib/catalog";
import type { PublicTemplate } from "@/lib/templates";
type Photo = { url: string; id?: string };
type Task = {
  id: string;
  status: string;
  resolution: string;
  error_code?: string;
  template_id?: string;
  created_at: number;
};
async function api(path: string, body?: unknown) {
  const r = await fetch(
    "/api/" + path,
    body === undefined
      ? { signal: AbortSignal.timeout(60000) }
      : {
          signal: AbortSignal.timeout(60000),
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  return readApiResponse(r);
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
function clearDrafts(keys: string[]) {
  return new Promise<void>((resolve) => {
    const req = indexedDB.open("smalltown-drafts", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("photos");
    req.onerror = () => resolve();
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("photos", "readwrite");
      for (const key of keys) tx.objectStore("photos").delete(key);
      tx.oncomplete = tx.onabort = () => {
        db.close();
        resolve();
      };
    };
  });
}
const isActive = (task: Task) => !["completed", "failed"].includes(task.status);
const isWaiting = (task: Task) =>
  ["queued", "submitting", "processing"].includes(task.status);
function taskLabel(task: Task) {
  if (task.status === "completed") return "Ready";
  if (task.status === "failed") return "Failed · credits returned";
  if (task.status === "review") return "Needs review";
  if (task.status === "unknown") return "Needs attention";
  if (task.status === "queued") return "Queued";
  if (task.status === "submitting") return "Starting";
  if (
    task.error_code?.startsWith("OUTPUT_") ||
    task.error_code === "INVALID_MP4"
  )
    return "Waiting to save";
  return "Generating";
}
export function Generator() {
  const [photos, setPhotos] = useState<(Photo | null)[]>([null, null]);
  const [subjectMode, setSubjectMode] = useState<"human" | "pet">("human");
  const [templateId, setTemplateId] = useState("living-room");
  const [resolution, setResolution] = useState<Resolution>("480p");
  const [user, setUser] = useState<{
    id: string;
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [queueRevision, refreshQueue] = useState(0);
  const [queueError, setQueueError] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const queueVersion = useRef(0);
  const taskSnapshot = useRef<Task[]>([]);
  const photoUrls = useRef<string[]>([]);
  const draftVersion = useRef(0);
  const [consent, setConsent] = useState(false);
  const inputs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const key = useRef<string | null>(null);
  const recovering = useRef(false);
  const [pending, setPending] = useState<PendingGeneration | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!user || recovering.current) return;
    const saved = readPendingGeneration(
      localStorage.getItem(PENDING_GENERATION_KEY),
      user.id,
    );
    if (!saved) return;
    recovering.current = true;
    setPending(saved);
    setConsent(true);
    setSubjectMode(saved.payload.subjectMode ?? "pet");
    setResolution(saved.payload.resolution);
    setTemplateId(saved.payload.templateId);
    key.current = saved.payload.requestKey;
    void continueGeneration(saved);
  }, [user?.id]);
  useEffect(() => {
    if (!pending) return;
    const update = () =>
      setElapsed(Math.floor((Date.now() - pending.startedAt) / 1000));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [pending]);
  useEffect(() => {
    api("config")
      .then((c) => {
        setConfig(c);
        if (recovering.current) return;
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
        const savedResolution = currentResolution(
          localStorage.getItem("smalltown-resolution") ?? "",
        ) as Resolution;
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
    const version = draftVersion.current;
    for (let i = 0; i < 2; i++)
      restoreDraft(String(i)).then((f) => {
        if (f && draftVersion.current === version)
          setPhotos((p) =>
            p.map((v, n) => (n === i ? { url: URL.createObjectURL(f) } : v)),
          );
      });
  }, []);

  useEffect(() => {
    const next = photos.flatMap((p) => (p ? [p.url] : []));
    for (const url of photoUrls.current)
      if (!next.includes(url)) URL.revokeObjectURL(url);
    photoUrls.current = next;
  }, [photos]);

  function refreshWallet(owner: string) {
    void api("me")
      .then((fresh) => {
        setUser((current) =>
          current?.id === owner && fresh.id === owner ? fresh : current,
        );
        window.dispatchEvent(new Event("wallet-updated"));
      })
      .catch(() => {});
  }

  useEffect(() => {
    const owner = user?.id;
    if (!owner) return;
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (stopped || running || document.hidden) return;
      clearTimeout(timer);
      running = true;
      const version = queueVersion.current;
      let again = false;
      try {
        const next: Task[] = await api("tasks?view=studio");
        if (stopped || version !== queueVersion.current) return;
        if (
          taskSnapshot.current.some(
            (previous) =>
              isActive(previous) &&
              next.some(
                (current) => current.id === previous.id && !isActive(current),
              ),
          )
        )
          refreshWallet(owner!);
        taskSnapshot.current = next;
        setTasks(next);
        setQueueError(false);
        again = next.some(isActive);
      } catch (e) {
        if (!stopped && version === queueVersion.current) {
          setQueueError(true);
          again = (e as { status?: number }).status !== 401;
        }
      } finally {
        running = false;
        if (!stopped && again) timer = setTimeout(poll, 5000);
      }
    }
    void poll();
    document.addEventListener("visibilitychange", poll);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [user?.id, queueRevision]);

  async function choose(i: number, file?: File) {
    if (!file || pending) return;
    setMessage("");
    setSubmitted(false);
    setConsent(false);
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
    setSubjectMode("pet");
    setConsent(false);
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
    setSubmitted(false);
    if (pending && user?.id === pending.owner) {
      await continueGeneration(pending);
      return;
    }
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
        body.append("file", await normalizePhoto(f));
        const r = await fetch("/api/uploads", {
          method: "POST",
          body,
          signal: AbortSignal.timeout(60000),
        });
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
        subjectMode,
        assetA: ids[0],
        assetB: ids[1],
        resolution,
        templateId,
        requestKey: key.current,
        consent: true,
      };
      const saved: PendingGeneration = {
        owner: user.id,
        startedAt: Date.now(),
        payload: {
          ...payload,
          templateId: templateId as "living-room" | "red-fence",
          consent: true,
        },
      };
      localStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(saved));
      setPending(saved);
      await continueGeneration(saved);
    } catch (e) {
      setMessage((e as Error).message);
      setBusy("");
    }
  }
  async function continueGeneration(saved: PendingGeneration) {
    setBusy("generate");
    setCheckingInputs(true);
    setMessage("Restoring your saved request. Checking progress…");
    try {
      let t: Task | undefined;
      // Bound this visit's wait; the original identity survives refreshes and retries.
      for (let attempt = 0; attempt < 10; attempt++) {
        if (!mounted.current) return;
        try {
          t = await api("tasks", saved.payload);
          break;
        } catch (error) {
          if ((error as { code?: string }).code !== "SAFETY_PENDING")
            throw error;
          setMessage((error as Error).message);
          await new Promise((resolve) => setTimeout(resolve, 30000));
        }
      }
      if (!mounted.current) return;
      if (!t)
        throw new Error(
          "Checks are taking longer than expected. Your request is saved. Resume to check again; do not upload the photos again.",
        );
      // The server now owns this task. Reset only the draft; status polling
      // follows the account's tasks independently of the next submission.
      queueVersion.current++;
      const next = [
        t,
        ...taskSnapshot.current.filter((row) => row.id !== t.id),
      ].slice(0, 5);
      taskSnapshot.current = next;
      setTasks(next);
      setSubmitted(true);
      setMessage("");
      draftVersion.current++;
      setPhotos([null, null]);
      setConsent(false);
      setSubjectMode("human");
      for (const input of inputs) if (input.current) input.current.value = "";
      key.current = null;
      refreshQueue((n) => n + 1);
      refreshWallet(saved.owner);
      await clearDrafts(["0", "1"]);
      localStorage.removeItem("smalltown-task");
      localStorage.removeItem(PENDING_GENERATION_KEY);
      setPending(null);
    } catch (e) {
      const corrupt = (e as { code?: string }).code === "INPUT_IMAGE_CORRUPT";
      if (corrupt) {
        const bad = (e as { assetId?: string }).assetId;
        setPhotos((photos) =>
          photos.map((photo, i) =>
            photo
              ? {
                  ...photo,
                  id:
                    (i === 0 ? saved.payload.assetA : saved.payload.assetB) ===
                    bad
                      ? undefined
                      : i === 0
                        ? saved.payload.assetA
                        : saved.payload.assetB,
                }
              : photo,
          ),
        );
        key.current = null;
      }
      const { status, code } = e as { status?: number; code?: string };
      const terminal =
        [400, 409, 422].includes(status ?? 0) || code === "SAFETY_UNAVAILABLE";
      if (status === 409) refreshQueue((n) => n + 1);
      if (terminal) {
        localStorage.removeItem(PENDING_GENERATION_KEY);
        setPending(null);
        key.current = null;
      }
      if (mounted.current)
        setMessage(
          (e as Error).message +
            (terminal
              ? ""
              : " Your request is saved; resume to check its status."),
        );
    } finally {
      if (mounted.current) {
        setCheckingInputs(false);
        setBusy("");
      }
    }
  }
  const activeCount = tasks.filter(isActive).length;
  const atLimit = activeCount >= ACTIVE_TASK_LIMIT;
  const locked = !!busy || !!pending;
  useEffect(() => {
    const select = (event: Event) => {
      const id = (event as CustomEvent).detail;
      if (!locked && config.templates.some((t) => t.id === id)) {
        setTemplateId(id);
        localStorage.setItem("smalltown-template", id);
        key.current = null;
      }
    };
    window.addEventListener("smalltown-template-selected", select);
    return () =>
      window.removeEventListener("smalltown-template-selected", select);
  }, [locked, config.templates]);
  const selectedTemplate = config.templates.find((t) => t.id === templateId);
  return (
    <section id="create" className="studio-create">
      <div className="studio-heading">
        <div>
          <span className="studio-kicker">01 / MAKE IT THEIRS</span>
          <h2>Cast your dancing duo.</h2>
          <p>
            One clear photo per person or pet. Choose the matching mode below.
          </p>
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
                  <small>
                    {i === 0
                      ? "Image 1 · Foreground at start"
                      : "Image 2 · Background at start"}
                  </small>
                </div>
                <div
                  className={"pet-dropzone " + (photos[i] ? "has-photo" : "")}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!locked) choose(i, e.dataTransfer.files[0]);
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
                        disabled={locked}
                        onClick={() => {
                          setPhotos((p) =>
                            p.map((v, n) => (n === i ? null : v)),
                          );
                          void clearDrafts([String(i)]);
                          setConsent(false);
                          key.current = null;
                        }}
                      >
                        <X size={17} />
                      </button>
                      <button
                        type="button"
                        className="pet-change"
                        disabled={locked}
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
                      disabled={locked}
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
                    disabled={locked}
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
        </div>
        <div className="studio-upload-footer">
          <span>
            <ShieldCheck size={15} />
            Your photos stay private.
          </span>
          <button type="button" onClick={samples} disabled={locked}>
            Try sample photos <ArrowUpRight size={14} />
          </button>
        </div>
        <aside className="studio-settings" aria-label="Video settings">
          <TemplatePicker
            templates={config.templates}
            selectedId={templateId}
            disabled={locked}
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
                    locked || (!config.mock && !config.resolutions.includes(r))
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
          <fieldset className="studio-quality">
            <legend className="studio-kicker">SUBJECT MODE</legend>
            <div className="quality-options subject-options">
              {(["human", "pet"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={subjectMode === mode}
                  className={subjectMode === mode ? "selected" : ""}
                  disabled={locked}
                  onClick={() => {
                    setSubjectMode(mode);
                    setConsent(false);
                    key.current = null;
                  }}
                >
                  {mode === "human" ? (
                    <Users size={17} />
                  ) : (
                    <PawPrint size={17} />
                  )}
                  {mode === "human" ? "Human duo" : "Pet duo"}
                </button>
              ))}
            </div>
          </fieldset>
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
              disabled={locked}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              {subjectMode === "human"
                ? "I’m 18+, both people are adults and consent to this video, and I have permission to use the photos."
                : "I have permission to use these pet photos."}{" "}
              <a href="/privacy">Privacy Policy</a>.
            </span>
          </label>
          <div className="studio-settings-action">
            <Button
              className="studio-generate"
              onClick={generate}
              disabled={!!busy || (!!user && !pending && atLimit)}
            >
              {busy === "generate" ? (
                <>
                  <Loader2 className="spin" size={18} />
                  {checkingInputs
                    ? "Checking your inputs…"
                    : "Uploading your photos…"}
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  {pending
                    ? "Resume saved request"
                    : !user
                      ? "Sign in to create your video"
                      : atLimit
                        ? "Both video slots are in use"
                        : user.wallet.balance < SPECS[resolution].credits
                          ? "Buy credits to create"
                          : "Generate video"}
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
          </div>
        </aside>
      </div>
      {(pending || message || submitted) && (
        <div className="studio-feedback" aria-live="polite">
          {message && (
            <div
              className={checkingInputs ? "status-note" : "error"}
              role={checkingInputs ? "status" : "alert"}
            >
              {checkingInputs ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <AlertCircle size={15} />
              )}
              {message}
            </div>
          )}
          {pending && (
            <p className="status-note">
              Draft saved · {Math.floor(elapsed / 60)}m {elapsed % 60}s elapsed.
              Refreshing won’t upload your photos again.
            </p>
          )}
          {submitted && !pending && (
            <p className="studio-submit-success" role="status">
              <Check size={16} /> Request saved. Track it below or add photos
              for another video.
            </p>
          )}
        </div>
      )}
      {(tasks.length > 0 || queueError) && (
        <section
          className="studio-task-list"
          aria-labelledby="studio-tasks-heading"
        >
          <div className="studio-task-header">
            <div>
              <h3 id="studio-tasks-heading">Your videos</h3>
              <p>
                {activeCount} of {ACTIVE_TASK_LIMIT} active slots in use
              </p>
            </div>
            <a className="text-link" href="/dashboard/videos">
              My Videos <ArrowUpRight size={14} />
            </a>
          </div>
          {queueError && (
            <p className="status-note">
              Couldn’t refresh video status. Open My Videos to check.
            </p>
          )}
          <ul>
            {tasks.map((task) => {
              const ready = task.status === "completed";
              const label = taskLabel(task);
              const template = config.templates.find(
                (t) => t.id === task.template_id,
              );
              return (
                <li key={task.id} className="studio-task">
                  <div className="studio-task-row">
                    <span className="studio-task-icon" aria-hidden="true">
                      <Film size={17} />
                    </span>
                    <div className="studio-task-info">
                      <strong>{template?.name ?? "Dance video"}</strong>
                      <small>
                        {task.resolution} · {task.id.slice(0, 8)}
                      </small>
                    </div>
                    <span
                      className="studio-task-status"
                      data-status={task.status}
                    >
                      {isWaiting(task) && (
                        <Loader2
                          size={13}
                          className="spin"
                          aria-hidden="true"
                        />
                      )}
                      {ready && <Check size={14} aria-hidden="true" />}
                      {label}
                    </span>
                    {ready && (
                      <div className="studio-task-actions">
                        <button
                          type="button"
                          className="studio-task-button"
                          aria-expanded={previewId === task.id}
                          onClick={() =>
                            setPreviewId(previewId === task.id ? null : task.id)
                          }
                        >
                          <Play size={14} />{" "}
                          {previewId === task.id ? "Close preview" : "Preview"}
                        </button>
                        <a
                          className="studio-task-button"
                          href={`/api/tasks/${task.id}/video?download=1`}
                          aria-label="Download MP4"
                        >
                          <Download size={15} />
                        </a>
                      </div>
                    )}
                  </div>
                  {ready && previewId === task.id && (
                    <video
                      className="studio-task-preview"
                      controls
                      playsInline
                      src={`/api/tasks/${task.id}/video`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}
