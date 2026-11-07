"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Play, Film } from "lucide-react";
import type { PublicTemplate } from "@/lib/templates";
import { PreviewVideo } from "./preview-video";
export function HomeVideos({ hero = false }: { hero?: boolean }) {
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json() as Promise<{ templates: PublicTemplate[] }>)
      .then((c) => setTemplates(c.templates || []))
      .catch(() => {});
  }, []);
  if (hero)
    return (
      <section className="studio-hero">
        <div className="studio-hero-copy">
          <span className="studio-kicker hero-pill">
            <Film size={15} /> TWO PHOTOS. TWO PERSONALITIES.
          </span>
          <h1>
            Turn 2 photos into
            <br />
            <span>Smalltown Boy AI</span>
            <br />
            dance videos.
          </h1>
          <p>
            The look. The reaction. The dance.
            <br />
            Give your favorite pets their own 14-second double act.
          </p>
          <a href="#create" className="button button-primary hero-create">
            Create your duo <ArrowUpRight size={20} />
          </a>
          <div className="hero-facts">
            <span>2 pet photos</span>
            <span>14-second dance</span>
            <span>No prompts needed</span>
          </div>
        </div>
        <div className="studio-hero-video">
          <PreviewVideo
            src={templates[0]?.previewUrl}
            label="Living room dance"
            autoPlay
            badge={
              templates[0]?.previewKind === "demo"
                ? "LOCAL TEST CLIP"
                : "TEMPLATE PREVIEW"
            }
          />
          <p>Preview the choreography. Your pets are next.</p>
        </div>
      </section>
    );
  return (
    <section id="templates" className="section video-showcase">
      <span id="examples" className="section-anchor" />
      <div className="section-heading-row">
        <div>
          <span className="studio-kicker">SEE THE DANCE</span>
          <h2>
            Same moves.
            <br />
            Your kind of duo.
          </h2>
        </div>
        <p>
          Pick the scene that feels like them.
          <br />
          Source template previews; generated examples are coming soon.
        </p>
      </div>
      <div className="showcase-grid">
        {templates.map((t, i) => (
          <article key={t.id} className="showcase-card">
            <PreviewVideo
              src={t.previewUrl}
              label={t.name}
              badge={
                t.previewKind === "demo"
                  ? "LOCAL TEST CLIP"
                  : `0${i + 1} / SOURCE TEMPLATE`
              }
            />
            <div className="showcase-caption">
              <div>
                <h3>{t.name}</h3>
                <p>{t.description}</p>
              </div>
              <a
                href="#create"
                aria-label={`Create with ${t.name}`}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("smalltown-template-selected", {
                      detail: t.id,
                    }),
                  )
                }
              >
                <ArrowUpRight size={24} />
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="showcase-note">
        <Play size={14} /> Play to preview. Tap sound to hear the template
        audio.
      </p>
    </section>
  );
}
