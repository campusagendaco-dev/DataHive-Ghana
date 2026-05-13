// Reusable Audio Effects Utility for SwiftData Ghana
// Allows triggering premium UI sounds (e.g., Cha-ching, chime alerts) across any component

export const SOUNDS = {
  SUCCESS_CHIME: "/sounds/success.mp3", // Crisp digital chime
  SYSTEM_NOTIF: "/sounds/notification_system.mp3", // Modern system chime
};

let audioContextUnlocked = false;

// Optional: Pre-unlock web audio to prevent browser autoplay restriction errors on click
export function unlockAudio() {
  if (audioContextUnlocked) return;
  const unlock = () => {
    audioContextUnlocked = true;
    document.removeEventListener("click", unlock);
    document.removeEventListener("touchstart", unlock);
  };
  document.addEventListener("click", unlock);
  document.addEventListener("touchstart", unlock);
}

export function playSound(path: string, volume = 0.4) {
  try {
    const audio = new Audio(path);
    audio.volume = volume;
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // Browser autoplay block fallback — logs silently, doesn't crash
        console.log("[Audio] Playback paused until user interaction.", error.message);
      });
    }
  } catch (err) {
    console.error("[Audio] Fatal audio execution failure:", err);
  }
}

export function playSuccessSound() {
  playSound(SOUNDS.SUCCESS_CHIME, 0.5);
}

export function playAlertSound() {
  playSound(SOUNDS.SYSTEM_NOTIF, 0.4);
}
