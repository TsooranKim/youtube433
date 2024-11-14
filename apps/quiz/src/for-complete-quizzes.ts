import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

import prettier from "prettier";
import { v4 as uuid } from "uuid";

import { completeQuizzies, makeAnswerNumberUnique } from "./lib";

const main = async () => {
  const chatId = Date.now() + "_" + uuid();
  console.log(`Chat ID: ${chatId}`);

  const questionsFilePath = path.resolve(process.env.RESULT_PATH, process.env.TARGET_RESULT_NO, "questions.txt");
  if (!existsSync(questionsFilePath)) {
    throw new Error(`${questionsFilePath} 파일이 존재하지 않습니다.`);
  }
  const questions = (await fs.readFile(questionsFilePath, "utf-8"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const quizzes = await completeQuizzies(chatId, questions);

  const quizzesThatHaveUniqueAnswers = makeAnswerNumberUnique(quizzes);

  const resultPath = `${process.env.RESULT_PATH}/${process.env.TARGET_RESULT_NO}`;
  await fs.mkdir(resultPath, { recursive: true });

  const jsonPath = path.resolve(resultPath, "quizzes.json");
  console.log(`문제를 JSON 파일로 저장합니다: ${jsonPath}`);

  const prettierOptionFilePath = path.resolve(__dirname, "../../../.prettierrc.json");
  const prettierOptions = await prettier.resolveConfig(prettierOptionFilePath);
  if (prettierOptions == null) {
    throw new Error(`Cannot find prettier config file at ${prettierOptionFilePath}`);
  }

  const formattedJson = await prettier.format(JSON.stringify(quizzesThatHaveUniqueAnswers), {
    ...prettierOptions,
    parser: "json",
  });

  await fs.writeFile(jsonPath, formattedJson, {
    encoding: "utf-8",
  });
};

main();
