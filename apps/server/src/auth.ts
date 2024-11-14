import { google } from "googleapis";

export const TOKEN_STORE_KEY = "GOOGLE_API_TOKEN";

export const oAuthClient = new google.auth.OAuth2(
  process.env.GOOGLE_API_CLIENT_ID,
  process.env.GOOGLE_API_CLIENT_SECRET,
  `http://localhost:${process.env.PORT}/oauth`,
);

export const authorizeUrl = oAuthClient.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/youtube.upload"],
});
