import { env } from "../env";

const now = Date.now();
const hasTempEnv = env("TEMP_UNTIL", "NO") !== "NO";

const SOURCE_PATH = env("SOURCE_PATH") + "/short";
const RESULT_PATH =
  hasTempEnv && parseInt(env("TEMP_UNTIL")) > now
    ? `${env("TEMP_RESULT_PATH")}/${env("TEMP_TARGET_RESULT_NO")}`
    : `${env("RESULT_PATH")}/${env("TARGET_RESULT_NO")}`;

export const SEQUENCE_PRESET_PATH = `${SOURCE_PATH}/sequence.sqpreset`;
export const ENCODER_PRESET_PATH = `${SOURCE_PATH}/encoder.epr`;

export const TITLE_MOGRT_PATHS: Record<string, string> = {
  "1": `${SOURCE_PATH}/title1.mogrt`,
  "2": `${SOURCE_PATH}/title2.mogrt`,
  "3": `${SOURCE_PATH}/title3.mogrt`,
};
export const QUESTION_MOGRT_PATH = `${SOURCE_PATH}/question.mogrt`;
export const ANSWER_MOGRT_PATH = `${SOURCE_PATH}/answer.mogrt`;
export const BACKGROUND_IMAGE_PATH = `${SOURCE_PATH}/background.png`;
export const ENDING_MOGRT_PATH = `${SOURCE_PATH}/ending.mogrt`;

export const QUIZZES_JSON_PATH = `${RESULT_PATH}/quizzes.json`;
export const TTS_MDEIA_BASE_PATH = `${RESULT_PATH}/tts`;
export const OUTPUT_VIDEO_PATH = `${RESULT_PATH}/output.mp4`;

export const DELAY_AFTER_QUESTION_SECONDS = 0.7;

export const 순서: Record<string, string> = {
  "1": "한입",
  "2": "두입",
  "3": "세입",
  "4": "네입",
};

export enum VideoTrackIndex {
  DUMMY,
  BACKGROUND,
  TITLE,
  QUESTION,
  ANSWER,
}

export enum AudioTrackIndex {
  DUMMY,
  TIMER,
  TTS,
}
