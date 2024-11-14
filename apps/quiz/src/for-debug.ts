import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

import { checkbox } from "@inquirer/prompts";
import prettier from "prettier";
import { v4 as uuid } from "uuid";

import {
  loadPrevQuizzes,
  makeAnswerNumberUnique,
  generateQuizTitlesWithGPT,
  completeQuizzies,
  loadExcludeQuizzes,
  loadGeneratedQuizzes,
} from "./lib";

const main = async () => {
  const chatId = Date.now() + "_" + uuid();
  console.log(`Chat ID: ${chatId}`);

  const prevQuizzes = await loadPrevQuizzes({
    resultPath: process.env.RESULT_PATH,
    excludResultNo: [process.env.TARGET_RESULT_NO],
  });

  const excludeTitles = await loadExcludeQuizzes();

  const quizTitles = await generateQuizTitlesWithGPT({
    alreadyUsedTitles: prevQuizzes,
    excludeTitles,
    count: 10,
    target: "한국의 평범한 고등학교를 졸업한 사람",
    topic: "정치, 경제, 사회, 지리, 역사, 과학, 문화, 예술, 스포츠에 관한 상식",
    debug: true,
  });

  const currentGeneratedTitles: Array<string> = [];
  try {
    const currentGeneratedQuizzes = await loadGeneratedQuizzes({
      resultPath: process.env.RESULT_PATH,
      resultNo: process.env.TARGET_RESULT_NO,
    });
    currentGeneratedTitles.push(...currentGeneratedQuizzes.map((quiz) => quiz.question));
  } catch {
    // do nothing
  }

  const selectedQuizTitles = await checkbox({
    message: "문제를 선택해주세요",
    choices: [
      ...currentGeneratedTitles.map((title) => ({
        name: title,
        value: title,
        checked: true,
      })),
      ...quizTitles.map((quiz) => ({
        name: quiz,
        value: quiz,
      })),
    ],
  });

  const quizzes = await completeQuizzies(chatId, selectedQuizTitles);
  const uniqueAnswerQuizzes = makeAnswerNumberUnique(quizzes);

  const resultPath = `${process.env.RESULT_PATH}/${process.env.TARGET_RESULT_NO}`;
  await fs.mkdir(resultPath, { recursive: true });

  const jsonPath = path.resolve(resultPath, "quizzes.json");
  console.log(`문제를 JSON 파일로 저장합니다: ${jsonPath}`);

  const prettierOptionFilePath = path.resolve(__dirname, "../../../.prettierrc.json");
  const prettierOptions = await prettier.resolveConfig(prettierOptionFilePath);
  if (prettierOptions == null) {
    throw new Error(`Cannot find prettier config file at ${prettierOptionFilePath}`);
  }

  const formattedJson = await prettier.format(JSON.stringify(uniqueAnswerQuizzes), {
    ...prettierOptions,
    parser: "json",
  });

  await fs.writeFile(jsonPath, formattedJson, {
    encoding: "utf-8",
  });
};

main();
