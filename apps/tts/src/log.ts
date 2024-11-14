import "./env";

import fs from "node:fs/promises";
import path from "node:path";

import { TTS_MODEL, ONE_MINUTE } from "./common";

const TTS_GEN_LOG_PATH = path.resolve(process.env.STORE_PATH, "tts_gen_log.json");

type GenLog = {
  model: TTS_MODEL;
  timestamp: number;
};

export const readLogs = async (): Promise<GenLog[]> => {
  try {
    const data = await fs.readFile(TTS_GEN_LOG_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

export const addLog = async (log: GenLog) => {
  const now = Date.now();
  const logs = await readLogs();
  const newLogs: GenLog[] = [];
  for (const log of logs) {
    const diff = now - log.timestamp;
    if (diff > ONE_MINUTE) {
      continue;
    }
    newLogs.push(log);
  }
  newLogs.push(log);
  await fs.writeFile(TTS_GEN_LOG_PATH, JSON.stringify(newLogs, null, 2));
};
