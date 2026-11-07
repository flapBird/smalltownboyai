import { HomeVideos } from "@/components/home-videos";
import { Generator } from "@/components/generator";
import { Pricing } from "@/components/pricing";
import { FAQ } from "@/lib/catalog";
import { ArrowDown } from "lucide-react";
export default function Home() {
  return (
    <main id="main" className="duo-home">
      <link rel="canonical" href="https://smalltownboyai.one/" />
      <div className="home-container">
        <HomeVideos hero />
        <Generator />
        <HomeVideos />
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
