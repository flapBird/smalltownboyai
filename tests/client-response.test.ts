import { expect, it } from "vitest";
import { readApiResponse } from "../lib/client-response";
it("handles HTML service failures without exposing parser errors or discarding saved requests", async () => {
  await expect(
    readApiResponse(
      new Response("<!DOCTYPE html><html>Service unavailable</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    ),
  ).rejects.toMatchObject({
    status: 502,
    message: expect.stringContaining("Your task is saved"),
  });
  await expect(
    readApiResponse(new Response("<html>login</html>", { status: 401 })),
  ).rejects.toMatchObject({
    status: 401,
    message: expect.stringContaining("sign in"),
  });
  expect(
    await readApiResponse(
      Response.json({ id: "existing", status: "processing" }),
    ),
  ).toEqual({ id: "existing", status: "processing" });
});
it("retains typed API errors for moderation recovery", async () => {
  await expect(
    readApiResponse(
      Response.json(
        {
          error: "Repair photo",
          code: "INPUT_IMAGE_CORRUPT",
          assetId: "asset-b",
        },
        { status: 422 },
      ),
    ),
  ).rejects.toMatchObject({
    status: 422,
    code: "INPUT_IMAGE_CORRUPT",
    assetId: "asset-b",
  });
});
