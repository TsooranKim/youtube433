export type TTS_MODEL = "tts-1" | "tts-1-hd";

export const RPM: Record<TTS_MODEL, number> = {
  "tts-1": 50,
  "tts-1-hd": 3,
};

export const ONE_MINUTE = 60000;
