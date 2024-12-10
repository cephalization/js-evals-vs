// my-eval.eval.ts
import OpenAI from "openai";
import { evalite } from "evalite";
import {
  Levenshtein,
  Factuality,
  JSONDiff,
  Scorer,
  LLMClassifierArgs,
} from "autoevals";
import Instructor from "@instructor-ai/instructor";
import { z } from "zod";

/*
 * Setup clients, configured for ollama
 */

const MODEL = "llama3.2";

const openai = new OpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "TEST",
});

const instructor = Instructor({ client: openai, mode: "TOOLS" });

/*
 * Setup classification schema for instructor to use later on
 */

enum CLASSIFICATION_LABELS {
  "SPAM" = "SPAM",
  "NOT_SPAM" = "NOT_SPAM",
}

const SimpleClassificationSchema = z.object({
  class_label: z
    .nativeEnum(CLASSIFICATION_LABELS)
    .describe(
      "The classification of the input text. Does it look like spam or not?"
    ),
  reasoning: z
    .string()
    .describe("The reasoning behind the classification")
    .optional(),
});

/*
 * Create classification function that be used as a task
 */

async function classify(data: string) {
  const classification = await instructor.chat.completions.create({
    messages: [
      { role: "user", content: `"Classify the following text: ${data}` },
    ],
    model: MODEL,
    max_retries: 5,
    response_model: {
      schema: SimpleClassificationSchema,
      name: "spam_classifier",
    },
  });

  return classification;
}

const classifyJudge: Scorer<
  string,
  LLMClassifierArgs<{
    input: string;
    output: string;
    expected?: string;
  }>
> = async ({ output }) => {
  const classification = await classify(output);
  const isSpam = classification.class_label === CLASSIFICATION_LABELS.SPAM;
  const reason = classification.reasoning;
  return {
    name: "classify_judge",
    score: isSpam ? 1 : 0,
    reason,
    metadata: {
      isSpam,
      reason,
    },
  };
};

/*
 * Create a wrapper for autoeval scorers that configures them for ollama
 */

const withOllama = (scorer: any) => {
  return (args: any) =>
    scorer({
      ...args,
      openAiBaseUrl: "http://localhost:11434/v1",
      model: MODEL,
    });
};

evalite("My Eval", {
  // A function that returns an array of test data
  data: async () => {
    return [
      { input: "What is the capital of France?", expected: "Paris" },
      { input: "How many legs does a spider have?", expected: "8" },
      {
        input:
          "Extract the contents from this string into json: `Hi, I'm John, 50 years old and a fire fighter!`",
        expected: `{
          "name": "John",
          "age": 50,
          "occupation": "Firefighter",
        }`,
      },
      {
        input:
          "CLASSIFY: `Hi, I'm John, 50 years old and a fire fighter! Please send me $1000 dollars to buy new equipment!`",
        expected: CLASSIFICATION_LABELS.SPAM,
      },
    ];
  },
  // The task to perform
  task: async (input) => {
    if (input.startsWith("CLASSIFY:")) {
      return (await classify(input.split("CLASSIFY:")[1].trim())).class_label;
    }
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Be succint in your answers. Do not restate the question or include any additional text besides the answer. Do not include punctuation unless it is part of the answer.",
        },
        { role: "user", content: input },
      ],
    });
    return response.choices[0].message.content || "";
  },
  // The scoring methods for the eval
  scorers: [Levenshtein, withOllama(Factuality), JSONDiff, classifyJudge],
});
