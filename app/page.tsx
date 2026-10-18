import { Generator } from "@/components/generator";
import { Pricing } from "@/components/pricing";
import { FAQ } from "@/lib/catalog";
import {
  ArrowDown,
  ImagePlus,
  SlidersHorizontal,
  Clapperboard,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
export const metadata = { alternates: { canonical: "/" } };
export default function Home() {
  return (
    <main id="main">
      <div className="home-container">
        <section className="hero">
          <div className="hero-eyebrow">
            <span className="tiny-dot" /> A LITTLE DANCE. A LOT OF PERSONALITY.
          </div>
          <h1>
            Smalltown Boy AI
            <br />
            Video Generator<span className="heading-dot">.</span>
          </h1>
          <div className="hero-bottom">
            <p>
              Turn your pet photos into a hilarious double act.
              <br className="desktop-break" /> Two characters. One Smalltown
              Boy-inspired dance.
            </p>
            <a href="#create" className="hero-anchor">
              MEET YOUR NEXT DANCING DUO <ArrowDown size={17} />
            </a>
          </div>
        </section>
        <Generator />
        <section id="examples" className="section examples">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">THE IDEA BEHIND THE DANCE</span>
              <h2>
                Big personalities.
                <br />
                Tiny dancing shoes.
              </h2>
            </div>
            <p>
              One reacts. One steals the spotlight.
              <br />
              Together, they make the whole scene.
              <br />
              <span className="muted">
                Concept images below, not generated video examples.
              </span>
            </p>
          </div>
          <div className="example-grid">
            <figure>
              <img
                src="/images/character-a.png"
                alt="AI-generated tabby cat concept portrait"
                loading="lazy"
              />
              <figcaption>
                <span>01 / THE REACTION</span>
                <h3>A natural scene-stealer.</h3>
              </figcaption>
            </figure>
            <figure>
              <img
                src="/images/dance-preview.png"
                alt="Illustrative two-cat dance concept"
                loading="lazy"
              />
              <figcaption>
                <span>02 / THE DOUBLE ACT</span>
                <h3>Better together.</h3>
              </figcaption>
            </figure>
            <figure>
              <img
                src="/images/character-b.png"
                alt="AI-generated blue-eyed cat concept portrait"
                loading="lazy"
              />
              <figcaption>
                <span>03 / THE PERSONALITY</span>
                <h3>Unmistakably your pet.</h3>
              </figcaption>
            </figure>
          </div>
        </section>
        <section className="section how">
          <div className="section-head">
            <span className="eyebrow">FROM CAMERA ROLL TO DANCE FLOOR</span>
            <h2>A simple little routine.</h2>
          </div>
          <div className="how-grid">
            {[
              [
                ImagePlus,
                "01",
                "Pick your two stars",
                "Upload a clear photo for each pet. Front-facing, well-lit images work best.",
              ],
              [
                SlidersHorizontal,
                "02",
                "Set the scene",
                "Choose your resolution and review the credit cost before you commit.",
              ],
              [
                Clapperboard,
                "03",
                "Let them steal the show",
                "Track your task, preview the result and download your private MP4.",
              ],
            ].map(([Icon, n, title, desc]) => {
              const I = Icon as typeof ImagePlus;
              return (
                <article key={String(n)}>
                  <div className="how-icon">
                    <I size={23} />
                    <span>{String(n)}</span>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(desc)}</p>
                </article>
              );
            })}
          </div>
          <div className="feature-strip">
            <span>
              <Users size={17} />
              Two distinct characters
            </span>
            <span>
              <Smartphone size={17} />
              Vertical-first format
            </span>
            <span>
              <ShieldCheck size={17} />
              Private by design
            </span>
          </div>
        </section>
        <Pricing />
        <section className="section faq" id="faq">
          <div>
            <span className="eyebrow">A FEW THINGS TO KNOW</span>
            <h2>
              Curious?
              <br />
              Good company.
            </h2>
            <p>Something else on your mind?</p>
            <a className="text-link" href="mailto:support@smalltownboyai.one">
              Get in touch ↗
            </a>
          </div>
          <div className="faq-list">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="closing">
          <span className="eyebrow">EVERY DUO HAS A STORY</span>
          <h2>Give yours a dance break.</h2>
          <a className="button button-primary" href="#create">
            Create Your AI Video <ArrowDown size={16} />
          </a>
          <p>Currently in preview. No real charges or live generation.</p>
        </section>
      </div>
    </main>
  );
}
