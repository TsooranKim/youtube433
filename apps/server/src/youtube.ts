import path from "node:path";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { exec } from "node:child_process";

import prettier from "prettier";
import { google } from "googleapis";

import { Quiz } from "schema";
import { generateTtsWithGpt } from "tts";

import { MessageInfo } from "./common";
import { load, save } from "./store";
import { oAuthClient, TOKEN_STORE_KEY } from "./auth";
import { SlackAction } from "./command";

export const generateYoutube = async ({ messageInfo, quizzes }: { messageInfo: MessageInfo; quizzes: Quiz[] }) => {
  // console.log(`${messageInfo.processId} 유튜브 영상 생성 시작`);
  // try {
  //   const tokens = await load(TOKEN_STORE_KEY);
  //   if (tokens.expiry_date < Date.now()) {
  //     const { credentials } = await oAuthClient.refreshAccessToken();
  //     await save(credentials, TOKEN_STORE_KEY);
  //     oAuthClient.setCredentials(credentials);
  //     console.log("OAuth 토큰이 갱신되었습니다.");
  //   }
  // } catch (error) {
  //   console.error("구글 API 토큰 오류가 발생");
  //   await fetch("https://slack.com/api/chat.postMessage", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
  //     },
  //     body: JSON.stringify({
  //       channel: messageInfo.channel,
  //       text: "구글 API 토큰 오류가 발생했습니다. 개발자에게 문의해주세요.",
  //     }),
  //   });
  //   return;
  // }

  const youtube = google.youtube({
    version: "v3",
  });

  const channelsListResult = await youtube.channels.list({
    key: process.env.GOOGLE_API_KEY,
    part: ["contentDetails"],
    id: [process.env.YOUTUBE_CHANNEL_ID],
  });
  const playlistId = channelsListResult.data.items![0].contentDetails!.relatedPlaylists!.uploads!;

  const playlistItemsListResult = await youtube.playlistItems.list({
    key: process.env.GOOGLE_API_KEY,
    part: ["snippet"],
    playlistId,
  });

  const [latestNo] = playlistItemsListResult.data.items![0].snippet!.title!.match(/\d+/)!;
  console.log(`가장 최신 영상 번호: ${latestNo}`);
  const nextNo = Number(latestNo) + 1;

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: messageInfo.channel,
      text: `유튜브 영상(${nextNo}편)을 생성합니다. 잠시만 기다려주세요. (5분 이상 소요될 수 있습니다.)`,
    }),
  });

  const tempDirPath = path.resolve(process.env.STORE_PATH, "temp");
  const processDirPath = path.resolve(tempDirPath, messageInfo.processId);
  await fs.mkdir(processDirPath, { recursive: true });

  const quizzesJsonPath = path.resolve(processDirPath, "quizzes.json");
  const prettierOptionFilePath = path.resolve(__dirname, "../../../.prettierrc.json");
  const prettierOptions = await prettier.resolveConfig(prettierOptionFilePath);
  if (prettierOptions == null) {
    throw new Error(`Cannot find prettier config file at ${prettierOptionFilePath}`);
  }
  const formattedJson = await prettier.format(JSON.stringify(quizzes), {
    ...prettierOptions,
    parser: "json",
  });
  await fs.writeFile(quizzesJsonPath, formattedJson);
  console.log(`퀴즈 JSON 파일 생성: ${quizzesJsonPath}`);

  await generateTtsWithGpt({
    quizzes: quizzes,
    openAiApiKey: process.env.OPENAI_API_KEY,
    outputDirPath: processDirPath,
  });
  console.log(`TTS 생성 완료`);

  const videoFilePath = path.resolve(processDirPath, "output.mp4");
  try {
    await fs.stat(videoFilePath);
    await fs.rm(videoFilePath);
  } catch (error) {
    // do nothing
  }

  const tempEnvPath = path.resolve(process.env.ROOT_PATH, ".env.temp");
  await fs.writeFile(
    tempEnvPath,
    `TEMP_UNTIL=${Date.now() + 10000}\nTEMP_RESULT_PATH=${tempDirPath}\nTEMP_TARGET_RESULT_NO=${messageInfo.processId}`,
    "utf-8",
  );

  const args =
    "{" +
    [
      '"name":"ppro"',
      '"type":"extendscript-debug"',
      '"request": "launch"',
      `"script": "${process.env.ROOT_PATH}/apps/ppro/dist/script.js"`,
      '"hostAppSpecifier": "premierepro-24.0"',
    ].join(",") +
    "}";

  exec(
    [
      "open",
      "-a",
      '"/Users/sooran/Desktop/code-intel/code.app"',
      `'vscode://fabiospampinato.vscode-debug-launcher/launch?args=${args}'`,
    ].join(" "),
  );
  console.log(`프리미어 프로 실행`);

  try {
    await new Promise((resolve, reject) => {
      let interval: ReturnType<typeof setInterval> | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const clear = () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };

      interval = setInterval(async () => {
        try {
          await fs.stat(videoFilePath);
          clear();
          resolve(undefined);
        } catch (error) {
          // do nothing
        }
      }, 1000);

      timeout = setTimeout(
        () => {
          clear();
          reject(new Error("Timeout"));
        },
        1000 * 60 * 5,
      );
    });
  } catch (error) {
    throw new Error("영상 생성 시간이 초과되었습니다.");
  }
  console.log(`영상 생성 완료: ${videoFilePath}`);

  // 파일 생성 후 5초 대기
  await new Promise((resolve) => setTimeout(resolve, 1000 * 5));

  const title = `하루 상식 퀴즈 ${nextNo}편 #상식 #상식퀴즈 #퀴즈`;

  const insertResult = await youtube.videos.insert({
    auth: oAuthClient,
    part: ["id", "snippet", "status", "contentDetails"],
    requestBody: {
      snippet: {
        title,
        description: `하루 상식 퀴즈 ${nextNo}편! 상식 퀴즈로 머리를 채우세요! 앞으로도 계속 즐기고 싶다면 구독과 좋아요 부탁드립니다! #상식 #상식퀴즈 #퀴즈`,
      },
      status: {
        privacyStatus: "unlisted",
      },
    },
    media: {
      body: createReadStream(videoFilePath),
    },
  });
  const videoId = insertResult.data.id!;
  console.log(`영상 업로드 완료: ${videoId}`);

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: messageInfo.channel,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: title,
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "영상 보러가기",
              emoji: true,
            },
            url: `https://www.youtube.com/watch?v=${videoId}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              style: "primary",
              text: {
                type: "plain_text",
                text: "영상 공개하기",
                emoji: true,
              },
              value: videoId,
              action_id: SlackAction.PublishVideo,
            },
            {
              type: "button",
              style: "danger",
              text: {
                type: "plain_text",
                text: "영상 삭제하기",
                emoji: true,
              },
              value: videoId,
              action_id: SlackAction.DeleteVideo,
            },
          ],
        },
      ],
    }),
  });
};
