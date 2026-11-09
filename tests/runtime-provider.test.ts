import { it, expect } from "vitest";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
it.each(["human", "pet"] as const)(
  "submits %s references and polls with native Workers fetch",
  async (mode) => {
    const bundled = await build({
      stdin: {
        contents: `import {WaveSpeed} from './lib/providers/wavespeed'; export default {async fetch(){const client=new WaveSpeed('test');const id=await client.submitTask({subjectMode:'${mode}',video:'https://media.test/template.mp4',images:['https://media.test/a.png','https://media.test/b.png'],resolution:'480p',inputDuration:14});return Response.json(await client.queryTask(id));}};`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
    });
    const calls: string[] = [];
    const runtime = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        compatibilityDate: "2026-10-01",
        script: bundled.outputFiles[0].text,
        outboundService: async (request) => {
          calls.push(request.method);
          if (request.method === "POST") {
            const body: any = await request.json();
            expect(body.prompt).toContain(
              mode === "human" ? "two consenting adults" : "Nonhuman pets only",
            );
            if (mode === "human")
              expect(body.prompt).not.toContain("Nonhuman pets only");
            expect(body.reference_images).toEqual([
              "https://media.test/a.png",
              "https://media.test/b.png",
            ]);
            return Response.json({ data: { id: "existing-job" } });
          }
          return Response.json({
            data: {
              id: "existing-job",
              status: "completed",
              outputs: ["https://media.test/result.mp4"],
            },
          });
        },
      }),
    );
    try {
      const response = await runtime.dispatchFetch("http://localhost");
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: "existing-job",
        status: "completed",
      });
      expect(calls).toEqual(["POST", "GET"]);
    } finally {
      await runtime.dispose();
    }
  },
);
