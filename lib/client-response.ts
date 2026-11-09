export async function readApiResponse(response: Response) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    throw Object.assign(
      new Error(
        response.status === 401 || response.redirected
          ? "Please sign in again to check your saved task."
          : "The service returned an unexpected response. Your task is saved; status checks will retry.",
      ),
      { status: response.status },
    );
  }
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The service response was incomplete. Your task is saved; please retry shortly.",
    );
  }
  if (!response.ok)
    throw Object.assign(
      new Error(
        data.error || "The request could not be completed. Please try again.",
      ),
      { status: response.status, code: data.code, assetId: data.assetId },
    );
  return data;
}
