import type { Quiz } from "schema";

export const filePathFromProjectRoot = (filepath: string): string => {
  const __filename = $.fileName;
  const projectName = "youtube433";
  const projectRootPath = __filename.substring(0, __filename.indexOf(projectName) + projectName.length);
  return `${projectRootPath}/${filepath}`;
};

export const readLineFromFile = (filepath: string): Array<string> => {
  const file = new File(filepath);
  if (!file.exists) {
    throw new Error(`${filepath} not found`);
  }

  file.open("r");
  const lines: Array<string> = [];
  while (!file.eof) {
    lines.push(file.readln());
  }
  file.close();

  return lines;
};

export const loadQuizzes = (jsonPath: string): Array<Quiz> => {
  const lines = readLineFromFile(jsonPath);
  const jsonString = lines.join("\n");
  const quizzes = eval(`(${jsonString})`);

  return quizzes;
};
