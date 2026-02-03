import { LLMService as SharedLLMService } from "@shared/llm";

// Re-export to preserve existing imports within worker code, while routing to shared service
export class LLMService extends SharedLLMService {}
