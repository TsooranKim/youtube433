import { mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { v4 as uuid } from "uuid";

const JSON_PATH = path.resolve(process.env.STORE_PATH, "json");

mkdirSync(JSON_PATH, { recursive: true });

export const genKey = (): string => {
  return uuid();
};

export const save = async (data: any, key?: string): Promise<string> => {
  if (key == null) {
    key = uuid();
  }
  const filePath = path.resolve(JSON_PATH, `${key}.json`);
  await fs.writeFile(filePath, JSON.stringify(data), "utf-8");
  return key;
};

export const load = async <T = any>(key: string): Promise<T> => {
  const filePath = path.resolve(JSON_PATH, `${key}.json`);
  await fs.access(filePath);
  const data = await fs.readFile(filePath, "utf-8");
  return JSON.parse(data);
};
