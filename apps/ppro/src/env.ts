import { filePathFromProjectRoot, readLineFromFile } from "./utils";

function dotenv(filename: string, errorWhenNotFound: boolean = true) {
  const envFilePath = filePathFromProjectRoot(filename);
  const envFile = new File(envFilePath);
  if (!envFile.exists) {
    if (!errorWhenNotFound) {
      return;
    }
    throw new Error(`${filename} file not found`);
  }

  const envFileLines = readLineFromFile(envFilePath);
  for (const line of envFileLines) {
    if (line.length === 0 || line[0] === "#") {
      continue;
    }
    const [key, value] = line.split("=");
    if (key && value) {
      $.setenv(key, value);
    }
  }
}

dotenv(".env");
dotenv(".env.temp", false);

export const env = (name: string, defaultValue?: string): string => {
  const value = $.getenv(name);
  if (!value) {
    if (defaultValue) {
      return defaultValue;
    }
    throw new Error(`env(${name}) not found`);
  }
  return value;
};
