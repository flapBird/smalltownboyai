// Decode pixels before uploading; checking the file header alone does not prove
// that a remote decoder can read the complete image.
export async function normalizePhoto(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "This photo cannot be decoded. Re-export it as PNG or JPEG, then select it again.",
    );
  }
  try {
    if (
      bitmap.width < 256 ||
      bitmap.height < 256 ||
      bitmap.width > 4096 ||
      bitmap.height > 4096
    )
      throw new Error("Use a photo between 256 and 4096 pixels per side.");
    // Stay within SeeAPI's recommended decoding dimensions while preserving aspect ratio.
    const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale),
      height = Math.round(bitmap.height * scale);
    if (width < 256 || height < 256 || width * height < 78400)
      throw new Error(
        "This photo is too narrow or too small. Choose a less tightly cropped photo.",
      );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Photo processing is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(
                new Error("Photo export failed. Please select another photo."),
              ),
        "image/png",
      ),
    );
    if (blob.size > 8 * 1024 * 1024)
      throw new Error(
        "The processed photo exceeds 8 MB. Please choose a smaller photo.",
      );
    return new File([blob], "photo.png", { type: "image/png" });
  } finally {
    bitmap.close();
  }
}
