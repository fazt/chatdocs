import OpenAI from "openai";
import { config } from "../config.js";

export function getOpenAIClient() {
  if (!config.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. Please set it in .env"
    );
  }

  return new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl || "https://api.openai.com/v1",
  });
}
