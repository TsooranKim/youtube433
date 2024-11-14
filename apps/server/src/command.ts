import { generateQuizWithGPT, loadPrevQuizzes } from "quiz";
import { Quiz } from "schema";

import { load, save } from "./store";
import { generateYoutube } from "./youtube";
import { getIsGeneratingYoutube, setIsGeneratingYoutube } from "./lock";
import { MessageInfo } from "./common";

export enum SlackAction {
  RemoveMessage = "action-remove-message",
  OpenQuizSelectModal = "action-open-quiz-select-modal",
  OpenQuizEditModal = "action-open-quiz-edit-modal",
  DeleteVideo = "action-delete-video",
  PublishVideo = "action-publish-video",
}

export enum SlackModalCallbackId {
  QuizSelectModalSubmit = "quiz-select-modal-submit",
  QuizEditModalSubmit = "quiz-edit-modal-submit",
}

const quizToMarkdown = (quiz: Quiz) => {
  const choiceText = quiz.choices
    .map((choice, choiceIndex) => (quiz.answer === choiceIndex + 1 ? `- \`${choice}\`` : `- ${choice}`))
    .join("\n");

  return `*${quiz.question}*\n_${quiz.explanation}_\n${choiceText}`;
};

const markdownToQuiz = (markdown: string): Quiz => {
  const [questionMarkdown, markdownExplanation, ...markdownsOfChoice] = markdown.split("\n");
  let answer = -1;
  const choices = markdownsOfChoice.map((markdown, index) => {
    const matched = markdown.match(/^- (`)?(.+?)(`)?$/)!;
    if (matched[1] == null) {
      return matched[2];
    } else {
      answer = index + 1;
      return matched[2];
    }
  });

  return {
    question: questionMarkdown.slice(1, questionMarkdown.length - 1),
    choices,
    answer,
    explanation: markdownExplanation.slice(1, markdownExplanation.length - 1),
  };
};

const quizzesToNewQuizMessageBlock = ({
  quizzes,
  username,
  actionButtonValue,
}: {
  quizzes: Array<Quiz>;
  username: string;
  actionButtonValue: string;
}) => {
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "새로운 퀴즈 생성을 완료했습니다.",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `From \`${username}\`의 요청`,
      },
    },
    {
      type: "divider",
    },
    ...quizzes.flatMap((quiz, quizIndex) => [
      {
        type: "rich_text",
        block_id: `quiz-${quizIndex + 1}`,
        elements: [
          {
            type: "rich_text_section",
            elements: [
              {
                type: "text",
                text: quiz.question,
                style: {
                  bold: true,
                },
              },
              {
                type: "text",
                text: "\n",
              },
            ],
          },
          {
            type: "rich_text_list",
            style: "ordered",
            elements: quiz.choices.map((choice, choiceIndex) => ({
              type: "rich_text_section",
              elements: [
                {
                  type: "text",
                  style: {
                    code: quiz.answer === choiceIndex + 1,
                  },
                  text: choice,
                },
              ],
            })),
          },
          {
            type: "rich_text_section",
            elements: [
              {
                type: "text",
                text: "\n",
              },
              {
                type: "text",
                text: quiz.explanation ?? "",
              },
            ],
          },
        ],
      },
      {
        type: "divider",
      },
    ]),
    {
      type: "actions",
      block_id: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "선택",
          },
          action_id: SlackAction.OpenQuizSelectModal,
          style: "primary",
          value: actionButtonValue,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "수정",
          },
          action_id: SlackAction.OpenQuizEditModal,
          value: actionButtonValue,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "제거",
          },
          action_id: SlackAction.RemoveMessage,
          style: "danger",
          value: actionButtonValue,
        },
      ],
    },
  ];

  return blocks;
};

const extractQuizzesFromNewQuizMessageBlock = (blocks: Array<any>): Array<Quiz> => {
  const quizzes = blocks
    .filter((block: any) => block.block_id.startsWith("quiz-"))
    .map((block: any) => {
      const question = block.elements[0].elements[0].text as string;
      let answer: number = -1;
      const choices = block.elements[1].elements.map((item: any, index: number) => {
        const [text] = item.elements;
        if (text.style.code) {
          answer = index + 1;
        }
        return text.text;
      });
      const explanation = block.elements[2].elements[1].text as string;

      return {
        question,
        choices,
        answer,
        explanation,
      } satisfies Quiz;
    });

  return quizzes;
};

export const quizSelectModalSubmitAction = async (payload: any) => {
  const privateMetaData = JSON.parse(payload.view.private_metadata) as {
    message: MessageInfo;
  };

  const blockIdsOfFixedQuiz = payload.view.state.values.input.checkboxes.selected_options.map(
    (option: any) => option.value,
  );

  const fixedQuizzes = payload.view.state.values.input.checkboxes.selected_options.map((option: any) =>
    markdownToQuiz(option.text.text),
  ) as Array<Quiz>;

  const message: {
    channel: string;
    ts: string;
    as_user?: boolean;
    blocks?: Array<any>;
    text?: string;
  } = {
    channel: privateMetaData.message.channel,
    ts: privateMetaData.message.ts,
    as_user: true,
  };

  const { processId } = privateMetaData.message;

  try {
    message.blocks = await load(processId);
  } catch (error) {
    console.error(error);
    message.text = "퀴즈 선택이 완료된 메세지입니다.";
    return;
  }

  if (message.blocks) {
    message.blocks
      .filter((block) => block.block_id?.startsWith("quiz-"))
      .forEach((block) => {
        const { block_id } = block;
        if (blockIdsOfFixedQuiz.includes(block_id)) {
          block.elements[0].elements[0].text = `✅ ${block.elements[0].elements[0].text}`;
        } else {
          block.elements[0].elements[0].text = `❌ ${block.elements[0].elements[0].text}`;
          block.elements[0].elements[0].style.bold = false;
          block.elements[0].elements[0].style.strike = true;
        }
      });

    const index = message.blocks.findIndex((block) => block.block_id === "actions");
    if (index !== -1) {
      let text = `\`${payload.user.username}\`님이 퀴즈를 선택을 완료했습니다.`;
      if (fixedQuizzes.length === 3) {
        text += " (영상을 생성합니다.)";
      } else {
        text += " (문제를 재생성됩니다.)";
      }
      message.blocks[index] = {
        type: "section",
        text: {
          type: "mrkdwn",
          text,
        },
      };
    }
  }

  if (fixedQuizzes.length === 3) {
    if (getIsGeneratingYoutube()) {
      const postMessageResponse = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
        body: JSON.stringify({
          channel: privateMetaData.message.channel,
          text: "이미 다른 사용자가 유튜브 영상을 생성하고 있습니다. 잠시만 기다려주세요.",
        }),
      });
      const postMessageResponseBody = await postMessageResponse.json();
      // debugger
      return;
    }
    setIsGeneratingYoutube(true);
    generateYoutube({
      quizzes: fixedQuizzes,
      messageInfo: privateMetaData.message,
    })
      .catch(async (error) => {
        console.error(error);
        fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          },
          body: JSON.stringify({
            channel: privateMetaData.message.channel,
            text: "유튜브 영상 생성에 실패했습니다. 다시 시도해주세요.",
          }),
        });
      })
      .finally(async () => {
        setIsGeneratingYoutube(false);
        fetch("https://slack.com/api/chat.update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json;charset=utf-8",
            Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          },
          body: JSON.stringify({
            channel: privateMetaData.message.channel,
            ts: privateMetaData.message.ts,
            as_user: true,
            blocks: await load(privateMetaData.message.processId),
          }),
        });
      });
  } else {
    newQuizSlashCommand({
      channelId: privateMetaData.message.channel,
      username: payload.user.username,
      fixedQuizzes,
      processId,
    });
  }

  const chatUploadResponse = await fetch("https://slack.com/api/chat.update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify(message),
  });

  const json = await chatUploadResponse.json();

  // debugger;
};

export const quizEditModalSubmitAction = async (payload: any) => {
  const quizzes: Array<Partial<Quiz>> = [];
  for (const [key, value] of Object.entries(payload.view.state.values)) {
    const splittedKey = key.split("-");
    const quizIndex = parseInt(splittedKey[1], 10) - 1;
    const kind = splittedKey[2];

    if (!quizzes[quizIndex]) {
      quizzes[quizIndex] = {};
    }

    const valueKey = splittedKey.slice(0, splittedKey.length - 1).join("-") + "-value";
    const inputValue = (value as any)[valueKey];

    if (kind === "question") {
      quizzes[quizIndex].question = inputValue.value;
    } else if (kind === "explanation") {
      quizzes[quizIndex].explanation = inputValue.value;
    } else if (kind === "choice") {
      const choiceIndex = parseInt(splittedKey[3], 10) - 1;
      if (!quizzes[quizIndex].choices) {
        quizzes[quizIndex].choices = [];
      }
      quizzes[quizIndex].choices[choiceIndex] = inputValue.value;
    } else if (kind === "answer") {
      quizzes[quizIndex].answer = parseInt(inputValue.selected_option.value, 10);
    }
  }

  const privateMetaData = JSON.parse(payload.view.private_metadata) as {
    message: MessageInfo;
  };

  const processId = privateMetaData.message.processId;

  const blocks = quizzesToNewQuizMessageBlock({
    quizzes: quizzes as Array<Quiz>,
    username: payload.user.username,
    actionButtonValue: processId,
  });

  if (processId) {
    await save(blocks, processId);
  }

  const message = {
    channel: privateMetaData.message.channel,
    ts: privateMetaData.message.ts,
    as_user: true,
    blocks,
  };

  const chatUploadResponse = await fetch("https://slack.com/api/chat.update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify(message),
  });

  const json = await chatUploadResponse.json();
};

export const openQuizSelectModal = async (payload: any) => {
  const quizzes = extractQuizzesFromNewQuizMessageBlock(payload.message.blocks);

  const openModalResponse = await fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      trigger_id: payload.trigger_id,
      view: {
        type: "modal",
        callback_id: SlackModalCallbackId.QuizSelectModalSubmit,
        title: {
          type: "plain_text",
          text: "퀴즈 선택",
        },
        submit: {
          type: "plain_text",
          text: "완료",
        },
        private_metadata: JSON.stringify({
          message: {
            channel: payload.channel.id,
            ts: payload.message.ts,
            processId: payload.actions[0].value,
          } satisfies MessageInfo,
        }),
        blocks: [
          {
            type: "input",
            block_id: "input",
            optional: true,
            label: {
              type: "plain_text",
              text: "유지할 문제를 선택하세요.",
            },
            hint: {
              type: "plain_text",
              text: "선택하지 않는 문제는 <재생성>됩니다.",
            },
            element: {
              type: "checkboxes",
              action_id: "checkboxes",
              options: quizzes.map((quiz, quizIndex) => ({
                text: {
                  type: "mrkdwn",
                  text: quizToMarkdown(quiz),
                },
                value: `quiz-${quizIndex + 1}`,
              })),
            },
          },
        ],
      },
    }),
  });

  const json = await openModalResponse.json();
  // debugger;
};

export const openQuizEditModal = async (payload: any) => {
  const quizzes = extractQuizzesFromNewQuizMessageBlock(payload.message.blocks);

  const triggerId = payload.trigger_id;

  const openModalResponse = await fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      trigger_id: triggerId,
      view: {
        type: "modal",
        callback_id: SlackModalCallbackId.QuizEditModalSubmit,
        title: {
          type: "plain_text",
          text: "퀴즈 수정",
        },
        submit: {
          type: "plain_text",
          text: "완료",
        },
        private_metadata: JSON.stringify({
          message: {
            channel: payload.channel.id,
            ts: payload.message.ts,
            processId: payload.actions[0].value,
          } satisfies MessageInfo,
        }),
        blocks: quizzes.flatMap((quiz, quizIndex) => [
          {
            type: "input",
            block_id: `quiz-${quizIndex + 1}-question-input`,
            element: {
              type: "plain_text_input",
              initial_value: quiz.question,
              min_length: 1,
              max_length: 29,
              action_id: `quiz-${quizIndex + 1}-question-value`,
            },
            label: {
              type: "plain_text",
              text: quiz.question,
            },
          },
          {
            type: "input",
            block_id: `quiz-${quizIndex + 1}-explanation-input`,
            element: {
              type: "plain_text_input",
              initial_value: quiz.explanation,
              min_length: 1,
              action_id: `quiz-${quizIndex + 1}-explanation-value`,
            },
            label: {
              type: "plain_text",
              text: quiz.explanation,
            },
          },
          ...quiz.choices.map((choice, choiceIndex) => ({
            type: "input",
            block_id: `quiz-${quizIndex + 1}-choice-${choiceIndex + 1}-input`,
            element: {
              type: "plain_text_input",
              initial_value: choice,
              min_length: 1,
              max_length: 10,
              action_id: `quiz-${quizIndex + 1}-choice-${choiceIndex + 1}-value`,
            },
            label: {
              type: "plain_text",
              text: `${choiceIndex + 1}. ${choice}`,
            },
          })),
          {
            type: "input",
            block_id: `quiz-${quizIndex + 1}-answer-input`,
            label: {
              type: "plain_text",
              text: `정답: ${quiz.answer}`,
            },
            element: {
              type: "static_select",
              action_id: `quiz-${quizIndex + 1}-answer-value`,
              initial_option: {
                text: {
                  type: "plain_text",
                  text: quiz.answer.toString(),
                },
                value: quiz.answer.toString(),
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "1",
                  },
                  value: "1",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "2",
                  },
                  value: "2",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "3",
                  },
                  value: "3",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "4",
                  },
                  value: "4",
                },
              ],
            },
          },
          {
            type: "divider",
          },
        ]),
      },
    }),
  });

  const json = await openModalResponse.json();
};

export const removeMessageAction = async (payload: any) => {
  await fetch(payload.response_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `해당 메세지는 \`${payload.user.username}\`의 요청에 의해서 제거됐습니다.`,
          },
        },
      ],
    }),
  });
};

export const newQuizSlashCommand = async (options: {
  channelId: string;
  username: string;
  processId: string;
  target?: string;
  topic?: string;
  responseUrl?: string;
  fixedQuizzes?: Array<Quiz>;
}) => {
  try {
    const quizzes = (options.fixedQuizzes ?? []).slice(0, 3);
    if (quizzes.length < 3) {
      const countToGenerate = 3 - quizzes.length;

      const prevQuizzes = await loadPrevQuizzes({
        resultPath: process.env.RESULT_PATH,
      });

      const result = await generateQuizWithGPT({
        chatId: Date.now().toString() + "_" + options.processId,
        openAiApiKey: process.env.OPENAI_API_KEY,
        prevQuizzes,
        quizCount: countToGenerate,
        limit: {
          minCorrectionCount: 3,
          maxErrorCount: 3,
          maxRetryCount: 10,
        },
        target: options.target ?? "평범한 고등학교를 졸업한 사람",
        topic: options?.topic ?? "알고 있으면 언젠가 쓸모 있는 지식, 잘난 척하기 좋은 지식",
      });
      if (result.error) {
        throw new Error(result.reason);
      }

      quizzes.push(...result.quizzes);
    }

    const blocks = quizzesToNewQuizMessageBlock({
      quizzes,
      username: options.username,
      actionButtonValue: options.processId,
    });

    await save(blocks, options.processId);

    const postMessageResponse = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: options.channelId,
        blocks,
      }),
    });
    const postMessageResponseBody = await postMessageResponse.json();
  } catch (error) {
    console.error(error);

    const postMessageResponse = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: options.channelId,
        text: "미안하다! 에러가 발생했다! 다시 만들어라! 😭",
      }),
    });
    const postMessageResponseBody = await postMessageResponse.json();
  }
};
