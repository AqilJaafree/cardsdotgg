let context: AudioContext | undefined;
let enabled = false;
export function enableSound(value: boolean) { enabled = value; if (value) sound("turn"); }
export function sound(kind: "flip" | "hit" | "rare" | "turn" | "pack") {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    void context.resume();
    const start = context.currentTime;
    const notes = kind === "rare" ? [523,659,784,1046] : kind === "hit" ? [140,65] : kind === "pack" ? [180,360,720] : kind === "turn" ? [440,660] : [620,900];
    notes.forEach((frequency, i) => {
      const oscillator = context!.createOscillator(), gain = context!.createGain();
      oscillator.type = kind === "hit" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start + i * .07);
      gain.gain.setValueAtTime(0, start + i * .07);
      gain.gain.linearRampToValueAtTime(.055, start + i * .07 + .012);
      gain.gain.exponentialRampToValueAtTime(.001, start + i * .07 + .22);
      oscillator.connect(gain); gain.connect(context!.destination);
      oscillator.start(start + i * .07); oscillator.stop(start + i * .07 + .25);
    });
  } catch { /* Sound is optional; visuals continue on unsupported browsers. */ }
}
