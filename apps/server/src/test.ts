const quizzes = [
  { question: "한국에서 가장 긴 강은?", choices: ["낙동강", "한강", "금강", "섬진강"], answer: 1 },
  { question: "태양계에서 가장 가까운 행성은?", choices: ["화성", "금성", "수성", "목성"], answer: 3 },
  {
    question: "세계에서 가장 높은 폭포는?",
    choices: ["빅토리아 폭포", "나이아가라 폭포", "훌루 역폭포", "앙헬 폭포"],
    answer: 4,
  },
];

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
    type: "divider",
  },
  ...quizzes.flatMap((quiz) => [
    {
      type: "rich_text",
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
      ],
    },
    {
      type: "divider",
    },
  ]),
  {
    type: "input",
    label: {
      type: "plain_text",
      text: "선택한 문제는 유지되고 선택하지 않는 문제는 재생성됩니다.",
    },
    element: {
      type: "checkboxes",
      action_id: "quiz",
      options: quizzes.map((quiz, index) => ({
        text: {
          type: "plain_text",
          text: quiz.question,
        },
        value: (index + 1).toString(),
      })),
    },
  },
  {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "완료",
        },
      },
    ],
  },
];

console.log(
  JSON.stringify(
    {
      blocks,
    },
    null,
    2,
  ),
);
