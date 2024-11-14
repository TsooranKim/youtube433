import path from "node:path";
import { exec } from "node:child_process";

import dotenv from "dotenv";
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

import express from "express";

import { commandRequestSchema } from "./slack";
import {
  newQuizSlashCommand,
  SlackAction,
  removeMessageAction,
  openQuizSelectModal,
  quizSelectModalSubmitAction,
  openQuizEditModal,
  SlackModalCallbackId,
  quizEditModalSubmitAction,
} from "./command";
import { getIsGeneratingQuiz, setIsGeneratingQuiz } from "./lock";
import { oAuthClient, authorizeUrl, TOKEN_STORE_KEY } from "./auth";
import { genKey, load, save } from "./store";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/webhook/slack/command", (req, res) => {
  if (req.headers["content-type"] !== "application/x-www-form-urlencoded") {
    return res.status(400).end();
  }

  const { success, data } = commandRequestSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).end();
  }

  if (data.command === "/new_quiz") {
    if (getIsGeneratingQuiz()) {
      return res.json({
        response_type: "in_channel",
        text: `이미 다른 사용자가 퀴즈를 생성하고 있습니다. 잠시만 기다려주세요.`,
      });
    }
    setIsGeneratingQuiz(true);
    res.json({
      response_type: "in_channel",
      text: `새로운 퀴즈를 생성합니다. 잠시만 기다려주세요.`,
    });

    const [target, topic] = data.text
      .split(",")
      .map((text) => text.trim())
      .map((text) => (text.length > 0 ? text : undefined));

    const processId = genKey();
    newQuizSlashCommand({
      channelId: data.channel_id,
      username: data.user_name,
      processId,
      target,
      topic,
    }).finally(() => {
      setIsGeneratingQuiz(false);
    });
  }

  res.status(400).end();
});

app.post("/webhook/slack/interactivity", (req, res) => {
  res.status(200).end();

  const payload = JSON.parse(req.body.payload);

  if (payload.type === "block_actions") {
    const [action] = payload.actions;
    if (action.action_id === SlackAction.RemoveMessage) {
      removeMessageAction(payload);
      return;
    } else if (action.action_id === SlackAction.OpenQuizSelectModal) {
      openQuizSelectModal(payload);
      return;
    } else if (action.action_id === SlackAction.OpenQuizEditModal) {
      openQuizEditModal(payload);
      return;
    }
  } else if (payload.type === "view_submission") {
    if (payload.view.callback_id === SlackModalCallbackId.QuizSelectModalSubmit) {
      if (getIsGeneratingQuiz()) {
        return res.json({
          response_type: "in_channel",
          text: `이미 다른 사용자가 퀴즈를 생성하고 있습니다. 잠시만 기다려주세요.`,
        });
      }
      setIsGeneratingQuiz(true);
      quizSelectModalSubmitAction(payload).finally(() => {
        setIsGeneratingQuiz(false);
      });
      return;
    } else if (payload.view.callback_id === SlackModalCallbackId.QuizEditModalSubmit) {
      quizEditModalSubmitAction(payload);
      return;
    }
  }
});

app.get("/oauth", async (req, res) => {
  const { searchParams } = new URL(req.url, `http://localhost`);
  const code = searchParams.get("code");
  if (!code) {
    return res.contentType("text/plain").end("OAuth 인증이 실패했습니다.");
  }

  res.contentType("text/plain").end("OAuth 인증이 완료되었습니다.");

  const { tokens } = await oAuthClient.getToken(code);
  await save(tokens, TOKEN_STORE_KEY);

  oAuthClient.setCredentials(tokens);
});

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);

  try {
    const tokens = await load(TOKEN_STORE_KEY);
    console.log("저장된 OAuth 토큰을 사용합니다.");
    oAuthClient.setCredentials(tokens);
    if (tokens.expiry_date < Date.now()) {
      const { credentials } = await oAuthClient.refreshAccessToken();
      await save(credentials, TOKEN_STORE_KEY);
      console.log("OAuth 토큰이 갱신되었습니다.");
      oAuthClient.setCredentials(credentials);
    }
    console.log("OAuth 인증이 완료되었습니다.");
  } catch (error) {
    console.log("OAuth 인증이 필요합니다.");
    console.log(authorizeUrl);
    exec(`open "${authorizeUrl}"`);
  }
});
