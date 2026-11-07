import { HomeVideos } from "@/components/home-videos";
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
        <HomeVideos hero />
        <Generator />
        <HomeVideos />
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
