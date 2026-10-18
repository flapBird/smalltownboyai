import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createContext, runInContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Analytics } from "../components/analytics";
import { ANALYTICS_SCRIPT } from "../lib/analytics";

vi.mock("next/script", () => ({
  default: ({ id, children }: { id: string; children: string }) =>
    createElement("script", { id }, children),
}));

afterEach(() => vi.unstubAllEnvs());

function browser(origin: string) {
  const scripts: { id?: string; src?: string; async?: boolean }[] = [];
  const window = { location: new URL(origin) } as {
    location: URL;
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
    clarity?: ((...args: unknown[]) => void) & { q?: IArguments[] };
  };
  const document = {
    head: {
      appendChild: (script: (typeof scripts)[number]) => scripts.push(script),
    },
    createElement: vi.fn(() => ({})),
    getElementById: (id: string) => scripts.find((script) => script.id === id),
  };
  const context = createContext({ window, document });
  // Script elements are recorded, never fetched or executed by this harness.
  const run = () => runInContext(ANALYTICS_SCRIPT, context);
  return { window, document, scripts, run };
}

describe("analytics environment safeguards", () => {
  it.each(["development", "test"])("renders no loader in %s", (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    expect(renderToStaticMarkup(createElement(Analytics))).toBe("");
  });

  it("renders only the guarded inline bootstrap in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const html = renderToStaticMarkup(createElement(Analytics));
    expect(html).toContain('id="site-analytics"');
    expect(html).toContain(ANALYTICS_SCRIPT);
    expect(html).not.toContain("src=");
  });

  it.each([
    "http://localhost:3000",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
    "http://192.168.1.20:3000",
    "https://preview.workers.dev",
    "https://smalltownboyai.one.example.com",
    "http://smalltownboyai.one",
    "https://smalltownboyai.one:8443",
  ])(
    "creates no trackers on %s, even with the production bootstrap",
    (origin) => {
      const page = browser(origin);
      page.run();
      expect(page.document.createElement).not.toHaveBeenCalled();
      expect(page.scripts).toEqual([]);
      expect(page.window.dataLayer).toBeUndefined();
      expect(page.window.gtag).toBeUndefined();
      expect(page.window.clarity).toBeUndefined();
    },
  );

  it("initializes the supplied trackers once on the production origin", () => {
    const page = browser("https://smalltownboyai.one");
    page.run();
    expect(page.scripts).toEqual([
      {
        id: "ga4-script",
        async: true,
        src: "https://www.googletagmanager.com/gtag/js?id=G-BC37LL57GH",
      },
      {
        id: "clarity-script",
        async: true,
        src: "https://www.clarity.ms/tag/yzjg1z6gia",
      },
    ]);
    const queue = page.window.dataLayer!;
    expect(Array.from(queue[0])[0]).toBe("js");
    expect(Array.from(queue[1])).toEqual(["config", "G-BC37LL57GH"]);
    page.window.clarity!("event", "test-event");
    expect(Array.from(page.window.clarity!.q![0])).toEqual([
      "event",
      "test-event",
    ]);

    page.run();
    expect(page.scripts).toHaveLength(2);
    expect(page.window.dataLayer).toBe(queue);
    expect(queue).toHaveLength(2);
  });
});
