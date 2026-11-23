/**
 * A picture chosen for one instance.
 *
 * The instance store only knows icon indices, so a picture the person uploads is
 * kept beside the launcher's settings in local storage, keyed by instance id. It
 * is a presentation detail: losing it changes the card's picture, never the
 * instance, its worlds or its mods.
 */

const PREFIX = "maple.instanceIcon.";
/** Data addresses larger than this are refused rather than filling storage. */
export const MAX_ICON_BYTES = 2 * 1024 * 1024;

export function readInstanceIcon(id: string): string | null {
  try {
    return window.localStorage.getItem(`${PREFIX}${id}`);
  } catch {
    return null;
  }
}

export function writeInstanceIcon(id: string, dataUrl: string | null) {
  try {
    if (dataUrl) window.localStorage.setItem(`${PREFIX}${id}`, dataUrl);
    else window.localStorage.removeItem(`${PREFIX}${id}`);
  } catch {
    /* a custom picture is a convenience; the instance is unaffected */
  }
}

/** Reads an uploaded image as a data address, refusing what the card cannot use. */
export function readImageFile(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
    return Promise.reject(new Error("Choose a PNG, JPEG or WebP image."));
  }
  if (file.size > MAX_ICON_BYTES) {
    return Promise.reject(new Error("Choose an image smaller than 2 MB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}
