"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Film, RotateCcw } from "lucide-react";

export function PreviewVideo({
  src,
  label,
  badge = "TEMPLATE PREVIEW",
  autoPlay = false,
}: {
  src?: string | null;
  label: string;
  badge?: string;
  autoPlay?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    setMuted(true);
    setPlaying(false);
  }, [src]);
  useEffect(() => {
    const element = video.current;
    if (
      !element ||
      !autoPlay ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) element.play().catch(() => {});
        else element.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [src, autoPlay]);
  useEffect(() => {
    const silenceOthers = (event: Event) => {
      if ((event as CustomEvent).detail !== video.current) setMuted(true);
    };
    window.addEventListener("smalltown-video-sound", silenceOthers);
    return () =>
      window.removeEventListener("smalltown-video-sound", silenceOthers);
  }, []);
  return (
    <div className="preview-player">
      {src && !failed ? (
        <video
          ref={video}
          src={src + "#t=0.1"}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          aria-label={label}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="video-unavailable">
          <Film size={32} />
          <strong>
            {failed ? "Video couldn’t load" : "Preview coming soon"}
          </strong>
          {failed && (
            <button type="button" onClick={() => setFailed(false)}>
              <RotateCcw size={15} />
              Try again
            </button>
          )}
        </div>
      )}
      <span className="video-badge">{badge}</span>
      {src && !failed && (
        <div className="video-controls">
          <button
            type="button"
            aria-label={playing ? `Pause ${label}` : `Play ${label}`}
            onClick={() => {
              if (video.current?.paused)
                video.current.play().catch(() => setFailed(true));
              else video.current?.pause();
            }}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
            <span>{playing ? "Pause" : "Play"}</span>
          </button>
          <button
            type="button"
            aria-label={muted ? `Enable sound for ${label}` : `Mute ${label}`}
            aria-pressed={!muted}
            onClick={() => {
              if (muted) {
                window.dispatchEvent(
                  new CustomEvent("smalltown-video-sound", {
                    detail: video.current,
                  }),
                );
                video.current?.play().catch(() => {});
              }
              setMuted(!muted);
            }}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            <span>{muted ? "Tap sound" : "Sound on"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
