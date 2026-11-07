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
            <Film size={15} /> THE TWO-PHOTO DANCE STUDIO
          </span>
          <h1>
            Two pets.
            <br />
            One iconic
            <br />
            <span>double act.</span>
          </h1>
          <p>
            Turn two favorite photos into a 14-second Smalltown Boy-inspired
            dance.
          </p>
          <a href="#create" className="button button-primary hero-create">
            Make your duo <ArrowUpRight size={20} />
          </a>
          <div className="hero-facts">
            <span>2 pet photos</span>
            <span>14-second dance</span>
            <span>No prompts needed</span>
          </div>
        </div>
        <div className="hero-video-pair">
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
          </div>
          <div className="hero-second-video">
            <span className="studio-kicker">MEET THE MOVES</span>
            <PreviewVideo
              src={templates[1]?.previewUrl}
              label="Red fence dance"
              badge={
                templates[1]?.previewKind === "demo"
                  ? "LOCAL TEST CLIP"
                  : "SOURCE TEMPLATE"
              }
            />
            <p>
              Source templates
              <br />
              14-second choreography
            </p>
          </div>
        </div>
      </section>
    );
  return (
    <section id="templates" className="section video-showcase">
      <span id="examples" className="section-anchor" />
      <div className="section-heading-row">
        <div>
          <span className="studio-kicker">02 / FIND THEIR SCENE</span>
          <h2>Same moves. Different personalities.</h2>
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
                <span className="scene-meta">14 SECONDS / TWO PETS</span>
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
                Use this scene <ArrowUpRight size={18} />
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
