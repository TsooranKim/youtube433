import path from "node:path";
import fs from "node:fs/promises";

import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

import { input } from "@inquirer/prompts";
import { v4 as uuid } from "uuid";

import { QuizList } from "schema";

import {
  createInitialMessagesForCompleteQuizzes,
  chatWithGPT,
  loadPrevQuizzes,
  createUserMessage,
  CommandOrWord,
  extractQuizzesFromChatMessage,
} from "./lib";

const main = async () => {
  await fs.mkdir(process.env.STORE_PATH, { recursive: true });

  const chatId = Date.now() + "_" + uuid();
  console.log(`Chat ID: ${chatId}`);

  const target = await input({
    message: "문제를 풀수 있는 대상을 입력해주세요",
    default: "평범한 고등학교를 졸업한 사람",
  });

  const topic = await input({
    message: "문제의 주제를 입력해주세요",
    default: "알아두면 언젠가 쓸모있을지도 모르는 지식",
  });

  const count = await input({
    message: "몇 문제를 생성할까요?",
    default: "3",
    validate: (input) => {
      if (isNaN(Number(input))) {
        return "숫자를 입력해주세요";
      }

      return true;
    },
  });

  const prevQuizzes = await loadPrevQuizzes({
    resultPath: process.env.RESULT_PATH,
    excludResultNo: [process.env.TARGET_RESULT_NO],
  });

  const messages = await createInitialMessagesForCompleteQuizzes({
    target,
    topic: topic.trim().length > 0 ? topic : undefined,
    count: Number(count),
    prevQuizzes,
  });

  while (true) {
    const question = await input({
      message: "Enter your question",
    });

    if (question.trim().length === 0) {
      break;
    }

    if (question === CommandOrWord.SAVE_TEXT) {
      const lastMessage = messages[messages.length - 1];
      let quiz: QuizList;
      try {
        quiz = extractQuizzesFromChatMessage(lastMessage);
      } catch (error) {
        console.log("----- 저장 결과 -----");
        console.log("저장할 수 있는 형식이 아닙니다.");
        console.log("---------------");
        continue;
      }

      const questions = quiz.map((q) => q.question);

      const saveFilePath = path.resolve(process.env.STORE_PATH, `temp_questions.txt`);

      await fs.appendFile(saveFilePath, questions.join("\n") + "\n");

      console.log("----- 저장 결과 -----");
      console.log("저장되었습니다.");
      console.log("---------------");
    }

    messages.push(createUserMessage(question));

    const message = await chatWithGPT({
      openAiApiKey: process.env.OPENAI_API_KEY,
      chatId,
      messages,
    });

    console.log("----- 응답 -----");
    console.log(message.content);
    console.log("---------------");

    messages.push(message);
  }
};

main();
