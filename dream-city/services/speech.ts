// Thin wrapper over the browser Web Speech API with graceful fallback to typing.

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported() {
  return getCtor() !== null;
}

export function startDictation(handlers: {
  onText: (finalText: string, interim: string) => void;
  onStart?: () => void;
  onEnd: () => void;
  onError: (msg: string) => void;
}) {
  const Ctor = getCtor();
  if (!Ctor) {
    handlers.onError("Speech recognition isn't available in this browser — type instead.");
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = "en-GB";
  rec.continuous = true;
  rec.interimResults = true;
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    handlers.onText(finalText.trim(), interim);
  };
  rec.onerror = (e) => handlers.onError(e.error === "not-allowed" ? "Microphone permission was denied." : e.error);
  rec.onstart = () => handlers.onStart?.();
  rec.onend = handlers.onEnd;
  rec.start();
  return () => rec.stop();
}
