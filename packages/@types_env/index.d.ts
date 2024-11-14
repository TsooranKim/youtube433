declare namespace NodeJS {
  interface ProcessEnv {
    OPENAI_API_KEY: string;
    OPENAI_ORGANIZATION?: string;
    OPENAI_PROJECT?: string;

    GOOGLE_API_KEY: string;
    GOOGLE_API_CLIENT_ID: string;
    GOOGLE_API_CLIENT_SECRET: string;
    YOUTUBE_CHANNEL_ID: string;

    SLACK_BOT_TOKEN: string;

    ROOT_PATH: string;
    SOURCE_PATH: string;
    RESULT_PATH: string;
    TARGET_RESULT_NO: string;

    STORE_PATH: string;

    PORT: string;
  }
}
