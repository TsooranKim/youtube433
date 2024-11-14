import path from "node:path";
import fs from "node:fs/promises";

import { glob } from "glob";
import OpenAI from "openai";
import { isZodErrorLike } from "zod-validation-error";

import { Quiz, quizListSchema, QuizValidation, quizValidationSchema } from "schema";

type Messages = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming["messages"];
type Message = Messages[number];

export enum CommandOrWord {
  CREATE = "생성",
  RECREATE = "재생성",
  CHECK_DUPLICATION = "중복확인",
  REMOVE_DUPLICATION = "중복제거",
  SAVE_TEXT = "저장",
  CHECK_QUANTITY = "검토",
  YES_DUPLICATION = "있음",
  NO_DUPLICATION = "없음",
  CORRECT = "적절함",
  INCORRECT = "부적절함",
}

if (!process.env.STORE_PATH) {
  throw new Error("STORE_PATH is not defined, please load .env file");
}
const CHAT_MESSAGE_STORE_PATH = path.resolve(process.env.STORE_PATH, "chat-messages");

const saveChatMessage = async (chatId: string, message: Messages) => {
  const filepath = path.resolve(CHAT_MESSAGE_STORE_PATH, `${chatId}.json`);
  const json = JSON.stringify(message, null, 2);
  await fs.mkdir(CHAT_MESSAGE_STORE_PATH, { recursive: true });
  await fs.writeFile(filepath, json, "utf-8");
};

export const loadExcludeQuizzes = async () => {
  const exclude_quizzes_filepath = path.resolve(__dirname, "exclude_quizzes");
  try {
    await fs.access(exclude_quizzes_filepath);
  } catch {
    return [];
  }

  const lines = (await fs.readFile(exclude_quizzes_filepath, "utf-8"))
    .split("\n")
    .filter((line) => line.trim().length > 0);

  return lines;
};

export const loadGeneratedQuizzes = async (options: { resultNo: string; resultPath: string }): Promise<Array<Quiz>> => {
  const jsonPath = path.resolve(options.resultPath, `${options.resultNo}/quizzes.json`);
  const text = await fs.readFile(jsonPath, "utf-8");
  const json = JSON.parse(text);
  const quizzes = quizListSchema.parse(json);

  return quizzes;
};

export const loadPrevQuizzes = async (options: { resultPath: string; excludResultNo?: string[] }) => {
  const files = await glob("*/quizzes.json", {
    cwd: options.resultPath,
  });

  const prevQuizTitles: string[] = [];

  for (const file of files) {
    const [no] = file.split("/");
    if (options.excludResultNo != null && options.excludResultNo.length > 0) {
      if (options.excludResultNo.includes(no)) {
        continue;
      }
    }

    const quizzes = await loadGeneratedQuizzes({
      resultNo: no,
      resultPath: options.resultPath,
    });
    prevQuizTitles.push(...quizzes.map((quiz) => quiz.question));
  }

  return prevQuizTitles;
};

export const createInitialMessagesForJustQuizTitles = async (options: {
  target: string;
  topic: string;
  count: number;
  alreadyUsedTitles: string[];
  excludeTitles: string[];
}): Promise<Messages> => {
  const messages: Messages = [];

  messages.push(
    {
      role: "system",
      content: [
        "당신은 퀴즈 생성 프로그램입니다. 사용자에게 간단하고 흥미로운 퀴즈를 한국어로 작성하여 제공해야 합니다. 다음의 규칙을 반드시 준수하세요:",
        "",
        "1. 퀴즈는 한국어로 작성되어야 하며, 가능한 한 영어 단어는 사용하지 마세요.",
        "2. 퀴즈는 객관적으로 정답이 하나인 문제로 만들어야 하며, 주관적인 의견이나 다수의 정답이 가능한 문제는 만들 수 없습니다.",
        "3. 퀴즈 내용은 시간이 지나도 정답이 변하지 않는 영구적인 내용을 포함해야 합니다. 즉, 정답이 과학적 사실, 역사적 사실, 수학적 원리 등과 같이 변하지 않는 내용이어야 합니다.",
        "4. 사용자가 제공한 '이미 사용한 문제 목록'과 '수준 이하 문제 목록'에 포함된 문제와 중복되거나 비슷한 내용을 가진 문제는 생성하지 않습니다. 문제를 생성할 때는 이미 사용된 문제와의 유사성을 확인하고 새로운 문제를 만들어야 합니다. 문제의 내용, 주제, 형식 등을 구체적으로 검토하여 중복을 방지하세요.",
        "5. 주제와 관련하여 시간이 지남에 따라 변할 수 있는 내용, 예를 들어 소비 트렌드, 인기 순위, 통계 수치 등은 퀴즈 문제로 출제하지 않습니다. 정답이 주기적으로 변할 가능성이 있는 문제는 배제해야 합니다.",
        "6. 문제는 명확하고 구체적으로 표현되어야 하며, 모호하거나 애매한 표현은 피해야 합니다. 모든 문제는 정답이 명확하게 결정될 수 있도록 해야 합니다.",
        "7. 문제의 답변은 명확하고 정확해야 하며, 정답을 추측하기 어렵게 만드는 표현이나 혼동을 일으킬 수 있는 문구는 피해야 합니다.",
        "8. 사용자가 별도로 제공하는 '수준 이하 문제 목록'에 포함된 문제와 유사한 문제는 생성하지 않도록 합니다. 수준 이하 문제의 예시는 너무 기본적이거나 쉽게 정답을 유추할 수 있는 문제로, 이러한 문제를 피하기 위해 적절한 난이도의 문제를 생성해야 합니다.",
        "9. 퀴즈는 특정 대상에게 유용하고 흥미로운 내용이어야 합니다. 특히 상식 문제지만 유용하거나 흥미로운 정보를 제공하여 사용자에게 새로운 지식을 학습할 수 있도록 해야 합니다.",
        "10. 생성한 문제는 간단하고 명확하게 표현되어야 하며, 혼동을 일으킬 수 있는 모호한 표현을 피해야 합니다.",
        "11. 첫 번째 문제는 사용자들의 흥미와 호기심을 유발할 수 있는 내용을 포함해야 합니다. 흥미로운 사실이나 예상치 못한 정보를 활용하여 주의를 끌어야 합니다. 단, 이 문제도 시간이 지나도 정답이 변하지 않는 내용이어야 합니다.",
        "12. 모든 문제의 길이는 가능하면 30자를 넘지 않도록 합니다.",
        '13. 요청된 문제의 수를 정확히 생성하고, 각 문제는 줄바꿈 기호("\n")로 구분하여 출력합니다.',
        "14. 문제를 생성할 때, 이미 사용된 문제 목록과의 유사성을 확인하여 중복되지 않도록 주의합니다. 기존 문제의 초점과 세부사항을 고려하여 새로운 문제를 제안합니다.",
        "15. 정답이 언제나 하나로만 특정될 수 있는 문제를 생성하도록 합니다. 즉, 다수의 답변이 가능한 문제는 피해야 합니다.",
        "16. 문제는 사용자가 모를 수 있는 정보도 포함될 수 있으며, 다양한 주제를 다루어 사용자에게 새로운 정보를 학습할 수 있는 기회를 제공해야 합니다. 특히 상식 문제이지만 유용하거나 흥미로운 정보를 포함하도록 합니다.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        '"이미 사용한 문제 목록"은 다음과 같습니다:',
        ...options.alreadyUsedTitles.map((title) => `- ${title}`),
        "",
        "수준 이하 문제 목록은 다음과 같습니다:",
        ...options.excludeTitles?.map((title) => `- ${title}`),
        "",
        `이 목록을 참고하여 수준 이하 문제를 피하고, 새로운 퀴즈 문제를 ${options.count}개 만들어 주세요. 대상은 '${options.target}'이고, 주제는 '${options.topic}'입니다.`,
      ].join("\n"),
    },
  );

  return messages;
};

export const createInitialMessagesForCompleteQuizzes = async (options: {
  target: string;
  topic?: string;
  /** 기본 3 */
  count?: number;
  prevQuizzes?: string[];
  excludeQuizzes?: string[];
  noDefaultExcludeQuizzes?: boolean;
}) => {
  const messages: Messages = [];

  messages.push({
    role: "system",
    content: [
      [
        "당신은 퀴즈 유튜버의 전문적인 문제 출제자로서 퀴즈를 만들어야 한다.",
        "그렇기에 대상과 주제는 고려하되 랜던한 사람들이 볼 수 있음을 염두에 두고 만든다.",
        "당신의 유튜버는 이를 통해서 사람들이 더 많은 지식을 습득할 수 있기를 바란다.",
      ].join(" "),
      "",
      "문제는 다음과 같은 규칙을 따라야 한다.",
      "- 한국어로 작성한다. 가능한 영어 단어를 사용하지 않는다.",
      "- 출제된 문제는 이전에 사용된 문제와 중복되지 않아야 하며, 정답 번호도 서로 중복되어서는 안 된다. 중복 문제 발생 시 새로운 문제를 자동으로 생성하라.",
      `- 문제는 일반 상식을 기반으로 하여 "${options.target}"이 알 만한 적절한 난이도를 가져야 한다. 조금 더 어려워도 상관 없다.`,
      ...[options.topic ? `- 문제들의 주제: ${options.topic}` : ""],
      "- 문제가 객관적으로 정답이 있어야 하며, 주관적인 문제나 다수의 정답이 가능한 문제는 출제할 수 없다. 이를 위해 적절한 검증 절차를 도입하라.",
      "- 문제는 시간이 지나도 정답이 변하지 않는 내용을 포함해야 한다. 시간이 지나도 유효한 문제만 출제하라.",
      "- 첫 번째 문제는 사용자의 흥미를 유발할 수 있는 내용이어야 하며, 기본적인 상식 또는 특정 문화와 관련된 문제는 피해야 한다. 다양한 주제를 포함시켜라.",
      "- 문제를 검토할 때는 주제의 일치 여부, 난이도, 중복성 및 유사성, 자연스러움, 규칙 준수 여부를 포함한 기준에 따라 철저히 검토하라.",
    ].join("\n"),
  });

  const excludeQuizzes: string[] = [];
  if (!options.noDefaultExcludeQuizzes) {
    const defaultExcludeQuizzes = await loadExcludeQuizzes();
    excludeQuizzes.push(...defaultExcludeQuizzes);
  }
  if (options.excludeQuizzes && options.excludeQuizzes.length > 0) {
    excludeQuizzes.push(...options.excludeQuizzes);
  }
  if (excludeQuizzes.length > 0) {
    messages.push({
      role: "system",
      content: [
        ...excludeQuizzes.map((text) => `- ${text}`),
        "",
        "위 목록의 문제는 기대하는 수준 이하의 문제이다. 위 목록의 비슷한 문제는 만들지 않는다.",
      ].join("\n"),
    });
  }

  if (options.prevQuizzes && options.prevQuizzes.length > 0) {
    messages.push({
      role: "system",
      content: [
        ...options.prevQuizzes.map((text) => `- ${text}`),
        "",
        "위 문제 목록의 문제는 이미 사용된 문제들이다. 중복되는 문제를 만들지 않는다.",
      ].join("\n"),
    });
  }

  messages.push({
    role: "system",
    content: [
      `\`\`\`json`,
      JSON.stringify(require("schema/quiz.schema.json")),
      `\`\`\``,
      "",
      `- "${CommandOrWord.CREATE}"이라고 물어볼때만 위와 같은 형식으로 문제 ${options.count ?? 3}개를 만들어 준다. 반드시 Array 형태로 출력한다. 공백은 최소화 한다.`,
      `- 생성된 문제 Array는 반드시 \`\`\`json\`\`\` 코드 블럭으로 감싸서 출력한다.`,
      `- 생성된 문제의 길이를 schema에 기술된 대로 제한한다.`,
      `- "유저가 ${CommandOrWord.RECREATE}"라고 말한 경우, 직전에 만든 문제에서 앞에서 적절하다고 판단됨 문제는 재사용하고 그렇지 않은 문제만 제외하고 다시 생성한다.`,
      "",
      `\`\`\`json`,
      JSON.stringify(require("schema/quiz-validation.schema.json")),
      `\`\`\``,
      `- "${CommandOrWord.CHECK_QUANTITY}"라고 물어볼 경우 위 형식으로 검토 결과를 출력한다.`,
    ].join("\n"),
  });

  return messages;
};

export const extractValidationFromChatMessage = (message: Message): QuizValidation => {
  if (!message.content) {
    throw new Error("No content in the message");
  }

  const match = (message.content as string).match(/```json\n(.+)\n```/s);
  if (match == null) {
    throw new Error("JSON 형식이 없습니다.", {
      cause: message.content,
    });
  }

  let json: string;
  try {
    json = JSON.parse(match[1]);
  } catch (error) {
    throw new Error("JSON 형식이 잘못되었습니다. 파싱에러", {
      cause: match[1],
    });
  }

  try {
    return quizValidationSchema.parse(json);
  } catch (error) {
    if (isZodErrorLike(error)) {
      throw new Error("Quiz Validation JSON 형식이 잘못되었습니다.", {
        cause: json,
      });
    }
    throw error;
  }
};

export const extractQuizzesFromChatMessage = (message: Message): Quiz[] => {
  if (!message.content) {
    throw new Error("No content in the message");
  }

  const match = (message.content as string).match(/```json\n(.+)\n```/s);
  if (match == null) {
    throw new Error("JSON 형식이 없습니다.", {
      cause: message.content,
    });
  }

  let json: string;
  try {
    json = JSON.parse(match[1]);
  } catch (error) {
    throw new Error("JSON 형식이 잘못되었습니다. 파싱에러", {
      cause: match[1],
    });
  }

  try {
    return quizListSchema.parse(json);
  } catch (error) {
    if (isZodErrorLike(error)) {
      throw new Error("Quiz list JSON 형식이 잘못되었습니다.", {
        cause: json,
      });
    }
    throw error;
  }
};

export const createUserMessage = (content: string): Message => {
  return {
    role: "user",
    content,
  };
};

export const chatWithGPT = async (options: { openAiApiKey: string; chatId: string; messages: Messages }) => {
  const openai = new OpenAI({
    apiKey: options.openAiApiKey,
  });

  await saveChatMessage(options.chatId, options.messages);

  const chat = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 1,
    n: 1,
    messages: options.messages,
  });

  const message = chat.choices[0].message;

  await saveChatMessage(options.chatId, [...options.messages, message]);

  return message;
};

export const generateQuizTitlesWithGPT = async (
  options: Parameters<typeof createInitialMessagesForJustQuizTitles>[0] & {
    debug?: boolean;
  },
): Promise<string[]> => {
  const log = options.debug ? console.log : () => {};

  const messages = await createInitialMessagesForJustQuizTitles(options);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const result = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 1,
    n: 1,
    messages,
  });

  messages.push(result.choices[0].message);

  log(JSON.stringify(messages, null, 2));

  const titles = result.choices[0].message.content!.split("\n").map(x => x.trim()).filter(x => x);

  return titles;
};

export const generateQuizWithGPT = async (options: {
  openAiApiKey: string;
  chatId: string;
  target: string;
  topic?: string;
  debug?: boolean;

  /** 기본 3 */
  quizCount?: number;
  prevQuizzes?: string[];
  excludeQuizzes?: string[];
  noDefaultExcludeQuizzes?: boolean;

  limit: {
    maxRetryCount: number;
    maxErrorCount: number;
    minCorrectionCount: number;
  };
}): Promise<
  | {
      success: true;
      error?: undefined;
      quizzes: Quiz[];
    }
  | {
      success?: undefined;
      error: true;
      reason: string;
    }
> => {
  const log = options.debug ? console.log : () => {};

  log(`대상: ${options.target}`);
  log(`주제: ${options.topic ?? "없음"}`);

  const messages = await createInitialMessagesForCompleteQuizzes({
    target: options.target,
    prevQuizzes: options.prevQuizzes,
    count: options.quizCount ?? 3,
    topic: options.topic,
    excludeQuizzes: options.excludeQuizzes,
    noDefaultExcludeQuizzes: options.noDefaultExcludeQuizzes,
  });

  const state: {
    retry: number;
    correctionCount: number;
    errorCount: number;
    lastRequestCommand: CommandOrWord | null;
    quizzes: Quiz[] | null;
  } = {
    retry: 0,
    correctionCount: 0,
    errorCount: 0,
    lastRequestCommand: null,
    quizzes: null,
  };

  const pushUserMessage = (command: CommandOrWord) => {
    let realCommand: string = command;
    if (realCommand === CommandOrWord.CHECK_QUANTITY) {
      realCommand = (state.correctionCount > 0 ? "초".repeat(state.correctionCount) + "정밀 " : "") + realCommand;
    }

    messages.push(createUserMessage(realCommand));

    if (command === CommandOrWord.RECREATE) {
      state.retry += 1;
      state.correctionCount = 0;
    } else if (command === CommandOrWord.CHECK_QUANTITY) {
      state.correctionCount += 1;
    }

    state.lastRequestCommand = command;
  };

  const extractQuizzesAndPushCheckQuantity = async (options: { message: Message; shouldUpErrorCount?: boolean }) => {
    try {
      state.quizzes = extractQuizzesFromChatMessage(options.message);
      pushUserMessage(CommandOrWord.CHECK_QUANTITY);
    } catch (error) {
      if (options.shouldUpErrorCount) {
        state.errorCount += 1;
        console.error(error);
      }
      pushUserMessage(CommandOrWord.RECREATE);
    }
  };

  pushUserMessage(CommandOrWord.CREATE);

  log("문제 생성을 시작합니다.");

  while (state.errorCount < options.limit.maxErrorCount && state.retry < options.limit.maxRetryCount) {
    log("----- 🙏요청🙏 -----");
    if (state.lastRequestCommand === CommandOrWord.RECREATE) {
      log(`${state.retry}번째 재생성`);
    } else if (state.lastRequestCommand?.endsWith(CommandOrWord.CHECK_QUANTITY)) {
      log(`${state.correctionCount}번째 검토`);
    } else {
      log(messages.at(-1)?.content);
    }

    const message = await chatWithGPT({
      openAiApiKey: process.env.OPENAI_API_KEY,
      chatId: options.chatId,
      messages,
    });
    messages.push(message);

    log("----- 🦾응답🦾 -----");
    log(message.content);

    if (state.lastRequestCommand === CommandOrWord.CREATE || state.lastRequestCommand === CommandOrWord.RECREATE) {
      await extractQuizzesAndPushCheckQuantity({
        message,
        shouldUpErrorCount: true,
      });
    } else if (state.lastRequestCommand?.endsWith(CommandOrWord.CHECK_QUANTITY)) {
      const validation = extractValidationFromChatMessage(message);
      if (validation.overall_evaluation === "적절함") {
        if (state.correctionCount >= options.limit.minCorrectionCount) {
          break;
        } else {
          pushUserMessage(CommandOrWord.CHECK_QUANTITY);
        }
      } else {
        pushUserMessage(CommandOrWord.RECREATE);
      }
    } else {
      throw new Error(`Invalid state.lastRequestCommand: ${state.lastRequestCommand}`);
    }
  }
  log("----- 🏁종료🏁 -----");

  if (state.quizzes == null) {
    log("알 수 없는 문제로 문제 생성이 실패했습니다.");
    return {
      error: true,
      reason: "알 수 없는 문제로 문제 생성이 실패했습니다.",
    };
  } else if (state.errorCount >= options.limit.maxErrorCount) {
    log(`문제 생성이 실패했습니다. (에러 횟수: ${state.errorCount})`);
    return {
      error: true,
      reason: `문제 생성이 실패했습니다. (에러 횟수: ${state.errorCount})`,
    };
  } else if (state.retry >= options.limit.maxRetryCount) {
    log(`문제 생성이 실패했습니다. (재시도 횟수: ${state.retry})`);
    return {
      error: true,
      reason: `문제 생성이 실패했습니다. (재시도 횟수: ${state.retry})`,
    };
  }

  log(`${state.retry}번 재생성, 문제 생성이 완료되었습니다.`);

  return {
    success: true,
    quizzes: state.quizzes,
  };
};

export const completeQuizzies = async (chatId: string, questions: string[]) => {
  const messages: Messages = [
    {
      role: "system",
      content: [
        `\`\`\`json`,
        JSON.stringify(require("schema/quiz.schema.json")),
        `\`\`\``,
        "",
        `- 문제를 주면 위 형식에 일치하게 선택지, 정답번호, 설명을 적절하게 생성해준다. 반드시 Array 형태로 출력한다. 공백은 최소화 한다.`,
        `- 생성된 문제 Array는 반드시 \`\`\`json\`\`\` 코드 블럭으로 감싸서 출력한다.`,
        `- 생성된 문제의 길이를 schema에 기술된 대로 제한한다.`,
      ].join("\n"),
    },
    {
      role: "user",
      content: [...questions.map((question) => `- ${question}`)].join("\n"),
    },
  ];

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const result = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 1,
    n: 1,
    messages,
  });

  const quizzies = extractQuizzesFromChatMessage(result.choices[0].message);

  messages.push(result.choices[0].message);
  await saveChatMessage(chatId, messages);

  return quizzies;
};

export const makeAnswerNumberUnique = (quizzes: Quiz[]): Quiz[] => {
  if (quizzes.length > 4) {
    return quizzes;
  }

  const newQuizzes: Quiz[] = [];
  const numbers = new Set<number>();

  for (const quiz of quizzes) {
    let newAnswer = -1;
    while (newAnswer === -1) {
      const random = Math.floor(Math.random() * quiz.choices.length) + 1;
      if (!numbers.has(random)) {
        numbers.add(random);
        newAnswer = random;
      }
    }

    const choices = [...quiz.choices];
    const [choice] = choices.splice(quiz.answer - 1, 1);
    choices.splice(newAnswer - 1, 0, choice);

    newQuizzes.push({
      ...quiz,
      answer: newAnswer,
      choices,
    });
  }

  return newQuizzes;
};
