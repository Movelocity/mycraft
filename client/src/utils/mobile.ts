export function isMobileUA(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

export async function enterFullscreen(): Promise<void> {
  await document.documentElement.requestFullscreen();
  const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> };
  if (orientation?.lock) {
    try {
      await orientation.lock('landscape');
    } catch {
      // Some browsers don't support orientation lock; caller handles the fallback
    }
  }
}

export function exitFullscreen(): Promise<void> {
  return document.exitFullscreen();
}

export function isLandscape(): boolean {
  return window.innerWidth > window.innerHeight;
}
