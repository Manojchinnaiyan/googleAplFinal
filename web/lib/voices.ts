// Pick the best available Web Speech voice for stadium PA-style alerts.
//
// Browser SpeechSynthesis voices vary a lot: macOS Safari ships premium
// neural voices ("Samantha", "Allison"), Chrome on macOS ships Google's
// network-only voices ("Google US English"), Edge ships Microsoft Online
// voices ("Aria", "Guy") which are genuinely great. Default robotic
// "eSpeak"-style voices are jarring for a demo, so we explicitly avoid
// them by ranking voices and picking the best.
//
// Web Speech doesn't load voices synchronously on every browser — Chrome
// fires "voiceschanged" once the list is populated, so callers must wait
// for it. waitForVoices() handles that.

const HIGH_QUALITY_PATTERNS = [
  /microsoft.*aria.*online/i,
  /microsoft.*jenny.*online/i,
  /microsoft.*guy.*online/i,
  /google\s+us\s+english/i,
  /google\s+uk\s+english\s+female/i,
  /google\s+uk\s+english\s+male/i,
  /samantha/i,
  /karen/i,
  /allison/i,
  /tom/i,
  /aaron/i,
  /natural/i,
  /premium/i,
  /enhanced/i,
];

const FALLBACK_LANGS = ["en-IN", "en-US", "en-GB", "en"];

export async function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined") return [];
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length) return voices;
  return await new Promise((resolve) => {
    const cleanup = () => {
      synth.removeEventListener("voiceschanged", onChange);
      clearTimeout(timer);
    };
    const onChange = () => {
      voices = synth.getVoices();
      if (voices.length) {
        cleanup();
        resolve(voices);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(synth.getVoices());
    }, timeoutMs);
    synth.addEventListener("voiceschanged", onChange);
  });
}

export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  // Score by quality pattern first, then by language preference.
  const scored = voices.map((v) => {
    const qIdx = HIGH_QUALITY_PATTERNS.findIndex((re) => re.test(v.name));
    const qScore = qIdx === -1 ? 100 : qIdx;
    const langIdx = FALLBACK_LANGS.findIndex((l) => v.lang.toLowerCase().startsWith(l.toLowerCase()));
    const langScore = langIdx === -1 ? 10 : langIdx;
    return { v, score: qScore * 10 + langScore };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0].v;
}
