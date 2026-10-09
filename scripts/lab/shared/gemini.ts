import { readFile } from "node:fs/promises";
import { config } from "dotenv";

config({ quiet: true });

const MODEL = "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

export async function requestGeminiJson(options: {
  prompt: string;
  filePath: string;
  mimeType: string;
  responseSchema: object;
}): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Bill extraction was not run.");
  }

  const file = await readFile(options.filePath);
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: options.prompt },
            {
              inline_data: {
                mime_type: options.mimeType,
                data: file.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: options.responseSchema,
      },
    }),
  });

  const body = (await response.json().catch(() => null)) as GeminiResponse | null;
  if (!response.ok) {
    throw new Error(
      `Gemini request failed (${response.status}): ${body?.error?.message ?? "no error message"}`,
    );
  }
  if (body?.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the document: ${body.promptFeedback.blockReason}`);
  }

  const text = body?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    const reason = body?.candidates?.[0]?.finishReason ?? "no response";
    throw new Error(`Gemini returned no extraction (${reason}).`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Gemini returned a response that was not valid JSON.");
  }
}
