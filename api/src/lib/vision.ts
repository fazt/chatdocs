import { getOpenAIClient } from "./openai.js";
import { config } from "../config.js";

export async function describeImage(buffer: Buffer, mimeType: string): Promise<string> {
  const openai = getOpenAIClient();
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const res = await openai.chat.completions.create({
    model: config.openaiModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this image in detail, focusing on visual elements, text visible, and any diagrams, charts, or UI elements. This description will be used for semantic search, so be thorough and use natural descriptive language.",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
        ],
      },
    ],
    max_tokens: 1000,
  });

  return res.choices[0]?.message?.content || "No description generated.";
}
