import "./env";

import fs from "node:fs";
import path from "node:path";

import { quizListSchema } from "schema";

import { downloadAudioFile, generateTtsWithGpt, getAnswerMessage, getQuestionMessage } from "./lib";

const OUTPUT_DIR_PATH = `${process.env.RESULT_PATH}/${process.env.TARGET_RESULT_NO}`;

const q = true;
const a = true;

const regen: {
  [key: number]: {
    q?: boolean;
    a?: boolean;
  };
} = { 1: { q, a } };

// TODO 숫자 처리 추가

const main = async () => {
  console.log("Reading quizzes.json...");
  const quizzesJson = require(`${OUTPUT_DIR_PATH}/quizzes.json`);
  const quizzes = quizListSchema.parse(quizzesJson);

  await generateTtsWithGpt({
    openAiApiKey: process.env.OPENAI_API_KEY,
    debug: true,
    quizzes,
    outputDirPath: OUTPUT_DIR_PATH,
    regen,
  });
};

main();
