import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import OpenAI from "openai";

import { type Quiz } from "schema";
import { 기수, 서수 } from "korean";

import { RPM, TTS_MODEL } from "./common";
import { addLog, readLogs } from "./log";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const waitLimit = async (model: TTS_MODEL): Promise<[number, Promise<void>] | null> => {
  const logs = await readLogs();
  const filteredLogs = logs.filter((log) => log.model === model);

  const now = Date.now();
  const limit = now - 60000;
  const count = filteredLogs.filter((log) => log.timestamp >= limit).length;

  if (count >= RPM[model]) {
    const lastLog = filteredLogs[logs.length - 1];
    const diff = now - lastLog.timestamp;
    const wait = 60000 - diff;
    return [wait, new Promise((resolve) => setTimeout(resolve, wait))];
  }

  return null;
};

const lockResolveQueue: (() => void)[] = [];
const lock = async () => {
  if (lockResolveQueue.length === 0) {
    return;
  }

  const promise = new Promise<void>((resolve) => {
    lockResolveQueue.push(resolve);
  });
  await promise;
};
const unlock = () => {
  const resolve = lockResolveQueue.shift();
  if (resolve) {
    resolve();
  }
};

export const getQuestionMessage = (quiz: Quiz, number: number): string => {
  return `문제 ${서수(number, "합")}입!! ${quiz.question}?!`;
};

export const getAnswerMessage = (quiz: Quiz): string => {
  const answer = quiz.choices[quiz.answer - 1];
  return `정답은 ${기수(quiz.answer)}번~! ${answer}~`;
};

export const downloadAudioFile = async (options: {
  model: TTS_MODEL;
  message: string;
  filepath: string;
  debug?: boolean;
}) => {
  const log = options.debug ? console.log : () => {};

  const waitResult = await waitLimit(options.model);
  if (waitResult) {
    const [waitMs, waitPromise] = waitResult;
    log(`Waiting for ${waitMs / 1000}s`);
    await waitPromise;
  }

  let response: Awaited<ReturnType<typeof openai.audio.speech.create>>;
  try {
    await lock();
    response = await openai.audio.speech.create({
      model: options.model,
      voice: "onyx",
      input: options.message,
    });
    addLog({ model: options.model, timestamp: Date.now() });
  } finally {
    unlock();
  }

  if (!response.ok) {
    throw new Error("Failed to fetch audio file", {
      cause: await response.text(),
    });
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const writeStream = fs.createWriteStream(options.filepath);

  await pipeline(response.body, writeStream);
};

export const generateTtsWithGpt = async (options: {
  openAiApiKey: string;
  debug?: boolean;
  quizzes: Quiz[];
  outputDirPath: string;
  regen?: {
    [key: number]: {
      q?: boolean;
      a?: boolean;
    };
  };
}) => {
  const log = options.debug ? console.log : () => {};

  const ttsDirPath = path.resolve(options.outputDirPath, "tts");
  fs.mkdirSync(ttsDirPath, { recursive: true });

  const isForRegen = options.regen && Object.keys(options.regen).length > 0;

  log("Downloading audio file...");
  for (let no = 1; no <= options.quizzes.length; no++) {
    const canGenQuestion = isForRegen ? (options.regen![no]?.q ?? false) : true;
    const canGenAnswer = isForRegen ? (options.regen![no]?.a ?? false) : true;
    const canGen = canGenQuestion || canGenAnswer;
    if (!canGen) {
      continue;
    }

    const quiz = options.quizzes[no - 1];

    if (canGenQuestion) {
      const questionMessage = getQuestionMessage(quiz, no);
      const questionFilepath = path.resolve(options.outputDirPath, "tts", `question-${no}.mp3`);
      log(`question ${no}: ${questionMessage}`);
      log(`downloading audio file for question ${no}`);
      await downloadAudioFile({
        model: "tts-1-hd",
        message: questionMessage,
        filepath: questionFilepath,
      });
    }

    if (canGenAnswer) {
      const answerMessage = getAnswerMessage(quiz);
      const answerFilepath = path.resolve(options.outputDirPath, "tts", `answer-${no}.mp3`);
      log(`answer ${no}: ${answerMessage}`);
      await downloadAudioFile({
        model: "tts-1-hd",
        message: answerMessage,
        filepath: answerFilepath,
      });
    }

    log(`Done downloading audio file for answer ${no}`);
  }

  log("Finished downloading audio files");
};
