import { z } from "zod";
import { getAiTaskConfig, type AiTaskType } from "@/lib/ai/router";

type ChatMessage = { role: "system" | "user"; content: string };

const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const apiMode = process.env.OPENAI_API_MODE || "responses";

function requireApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Thiếu OPENAI_API_KEY để xử lý AI.");
  return key;
}

async function openAiFetch(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireApiKey()}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI trả lỗi ${response.status}: ${text}`);
  }
  return response.json();
}

function zodToJsonSchema(schemaName: string, schema: z.ZodType<unknown>) {
  return {
    type: "json_schema",
    name: schemaName,
    strict: false,
    schema: {
      type: "object",
      additionalProperties: true
    },
    zodSchema: schema
  };
}

async function chatCompletion(model: string, maxOutputTokens: number, messages: ChatMessage[]) {
  const json = await openAiFetch("/chat/completions", {
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages,
    max_tokens: maxOutputTokens
  });
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI không trả về nội dung.");
  return content;
}

async function responsesCompletion<T>(taskType: AiTaskType, messages: ChatMessage[], schema: z.ZodType<T>) {
  const config = getAiTaskConfig<T>(taskType);
  const format = zodToJsonSchema(config.schemaName, schema);
  const json = await openAiFetch("/responses", {
    model: config.model,
    input: messages.map((message) => ({
      role: message.role,
      content: [{ type: "input_text", text: message.content }]
    })),
    reasoning: { effort: config.reasoningEffort },
    text: {
      verbosity: config.verbosity,
      format: {
        type: format.type,
        name: format.name,
        strict: format.strict,
        schema: format.schema
      }
    },
    max_output_tokens: config.maxOutputTokens
  });

  const outputText =
    json.output_text ||
    json.output
      ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
      .map((content: { text?: string }) => content.text || "")
      .join("");

  if (!outputText) throw new Error("AI không trả về nội dung.");
  return outputText;
}

export async function embedText(input: string) {
  const json = await openAiFetch("/embeddings", {
    model: embeddingModel,
    input
  });
  const vector = json.data?.[0]?.embedding;
  if (!Array.isArray(vector)) throw new Error("AI không trả về embedding hợp lệ.");
  return vector as number[];
}

export async function chatJson<T>(messages: ChatMessage[], schema: z.ZodType<T>) {
  return runAiJson("ANSWER_STANDARD", messages, schema);
}

export async function runAiJson<T>(taskType: AiTaskType, messages: ChatMessage[], schemaOverride?: z.ZodType<T>) {
  const config = getAiTaskConfig<T>(taskType);
  const schema = schemaOverride || config.schema;
  let workingMessages = messages;
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const content =
      apiMode === "chat"
        ? await chatCompletion(config.model, config.maxOutputTokens, workingMessages)
        : await responsesCompletion(taskType, workingMessages, schema);
    try {
      return schema.parse(JSON.parse(content));
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Sai định dạng JSON.";
      workingMessages = [
        ...messages,
        {
          role: "user",
          content: `JSON trước đó không hợp lệ với schema. Lỗi: ${lastError}. Trả lại DUY NHẤT một JSON object hợp lệ, không markdown, không giải thích.`
        }
      ];
    }
  }

  throw new Error("AI trả về sai định dạng sau nhiều lần thử. Nguồn đã được lưu, nhưng chưa tạo được tri thức tự động.");
}
