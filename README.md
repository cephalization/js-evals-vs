# JS Evaluations Battle

Test out the current landscape of LLM evaluation in TS.

Top level TS files will center around some evaluation framework, within which many libraries to fascilitate tasks and scorers are imported and tested.

## How to use

- Install node v20, pnpm
- Install [ollama](https://ollama.com/download)
  - Run `ollama run llama3.2`
  - You now have an ollama server running on `localhost:11434/v1` with the `llama3.2` model accessible over an openai-compatible HTTP API.
- Run `pnpm install`
- Run `pnpm run evalite`

This will run the `my-eval.eval.ts` file, which contains a single "evaluation" of multiple tasks, which are then scored by autoevals scorers wrapped in an ollama client.