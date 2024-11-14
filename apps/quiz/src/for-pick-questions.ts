import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

const main = async () => {
  const questionPoolFilePath = path.resolve(process.env.STORE_PATH, "questions.txt");
  if (!existsSync(questionPoolFilePath)) {
    throw new Error(`${questionPoolFilePath} 파일이 존재하지 않습니다.`);
  }

  const getUniqueNumbers = (max: number, count: number) => {
    const numbers = new Set<number>();
    while (numbers.size < count) {
      const random = Math.floor(Math.random() * max);
      if (numbers.has(random)) {
        continue;
      }
      numbers.add(random);
    }

    return Array.from(numbers);
  };

  const getQuestionsFromPool = async () => {
    const questions = (await fs.readFile(questionPoolFilePath, "utf-8"))
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return questions;
  };

  const updateQuestionsPool = async (questions: string[]) => {
    await fs.writeFile(questionPoolFilePath, questions.join("\n"), {
      encoding: "utf-8",
    });
  };

  for (let no = 35; no <= 50; no++) {
    const resultPath = `${process.env.RESULT_PATH}/${no}`;
    if (existsSync(resultPath)) {
      console.log(`${resultPath} 폴더가 이미 존재합니다.`);
      continue;
    }

    await fs.mkdir(resultPath, { recursive: true });

    const questions = await getQuestionsFromPool();
    const indices = getUniqueNumbers(questions.length, 3);
    const pickedQuestions = indices.map((index) => questions[index]);

    const questionsFilePath = path.resolve(resultPath, "questions.txt");
    console.log(`문제를 JSON 파일로 저장합니다: ${questionsFilePath}`);

    await fs.writeFile(questionsFilePath, pickedQuestions.join("\n") + "\n", {
      encoding: "utf-8",
    });

    const newQuestions = questions.filter((_, index) => !indices.includes(index));
    updateQuestionsPool(newQuestions);
  }
};

main();
