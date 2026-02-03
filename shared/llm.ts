import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPerplexity } from "@langchain/community/chat_models/perplexity";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Provider } from "./llm.models";
import { getModelsForProvider } from "./llm.models";
import { computeOpenAIEffectiveParams, computePerplexityEffectiveParams, computeGeminiEffectiveParams, getOpenAICapabilities } from "./llm.capabilities";
import { categorizeLLMError, getLLMErrorCode, type CategorizedLLMError } from "./llm.errors";

export type SupportedModel = Provider;

/**
 * Model configurations for each LLM provider
 * This ensures the UI labels stay in sync with actual model names
 */
export const LLM_MODEL_CONFIGS = {
  openai: {
    modelName: "gpt-4o-mini",
    displayName: "OpenAI GPT-4o-mini",
  },
  gemini: {
    modelName: "gemini-2.5-flash",
    displayName: "Google Gemini 2.5 Flash",
  },
  perplexity: {
    modelName: "sonar",
    displayName: "Perplexity Sonar",
  },
  deepseek: {
    modelName: "deepseek-chat",
    displayName: "DeepSeek Chat",
  },
  anthropic: {
    modelName: "claude-3-5-sonnet-latest",
    displayName: "Anthropic Claude 3.5 Sonnet",
  },
} as const;

export interface LLMResponse {
  content: string;
  success: boolean;
  error?: string;
  /**
   * Categorized error information (present when success is false)
   * Provides structured error details for better error handling and user messaging
   */
  categorizedError?: CategorizedLLMError;
}

export interface LLMServiceOptions {
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
}

/**
 * Shared LLM service using LangChain providers for consistent API interaction.
 * Provides unified interface across OpenAI, Gemini, Perplexity, DeepSeek, and Anthropic models.
 */
export class LLMService {
  private apiKeys: Record<string, string>;
  private models: Map<string, BaseChatModel>; // key: `${provider}:${modelId}`

  constructor(apiKeys: Record<string, string>) {
    this.apiKeys = apiKeys || {};
    this.models = new Map();
  }

  /**
   * Process structured messages: optional system + required user.
   * Used by server and worker when prompts provide systemText.
   */
  async processMessages(
    messagesInput: { systemText?: string; userText: string },
    model: SupportedModel,
    options: LLMServiceOptions & { modelId?: string } = {},
  ): Promise<LLMResponse> {
    const modelId = options.modelId;
    if (!modelId) {
      return { content: "", success: false, error: `Missing modelId for provider ${model}` };
    }
    const userLen = messagesInput.userText?.length || 0;
    const systemLen = messagesInput.systemText?.length || 0;
    const totalLen = userLen + systemLen;
    
    // Check if this is a reasoning model that needs extended timeout
    const isReasoningModel = model === "openai" && modelId && (() => {
      const caps = getOpenAICapabilities(modelId);
      return caps?.supportsReasoningEffort === true;
    })();
    
    const heuristicTimeout = (() => {
      // Reasoning models (GPT-5, o1, etc.) need much longer timeouts - 120-180 seconds
      if (isReasoningModel) {
        const baseReasoningTimeout = 120000; // 2 minutes base for reasoning models
        // Scale up for very long prompts
        if (totalLen > 12000) return Math.max(options.timeoutMs ?? 0, 180000);
        if (totalLen > 8000) return Math.max(options.timeoutMs ?? 0, 150000);
        return Math.max(options.timeoutMs ?? 0, baseReasoningTimeout);
      }
      // Standard models use original heuristic
      if (totalLen > 12000) return Math.max(options.timeoutMs ?? 0, 45000);
      if (totalLen > 8000) return Math.max(options.timeoutMs ?? 0, 30000);
      if (totalLen > 4000) return Math.max(options.timeoutMs ?? 0, 20000);
      return options.timeoutMs;
    })();
    const resolvedOptions = { ...options, timeoutMs: heuristicTimeout };
    
    if (isReasoningModel) {
      console.log(`[LLMService] Reasoning model detected - using extended timeout`, {
        provider: model,
        modelId,
        timeoutMs: heuristicTimeout,
      });
    }

    const chatModel = this.getOrCreateModel(model, modelId, resolvedOptions);
    const messageCallId = Math.random().toString(36).substring(2, 8);
    console.log(`[LLMService:${messageCallId}] processMessages:start`, { 
      provider: model, 
      modelId,
      hasSystem: Boolean(messagesInput.systemText), 
      systemLen, 
      userLen,
      totalLen,
      timeoutMs: heuristicTimeout,
      timestamp: new Date().toISOString(),
    });

    const invokeStart = Date.now();
    try {
      const result = await this.withTimeoutAndRetries(async (signal) => {
        const msgs = [new HumanMessage({ content: messagesInput.userText })];
        if (messagesInput.systemText && messagesInput.systemText.length > 0) {
          msgs.unshift(new SystemMessage(messagesInput.systemText));
        } else if (model === "gemini") {
          // Preserve plain-text nudge for Gemini if no user-provided system message
          msgs.unshift(new SystemMessage("Reply in plain text only. Do not call any tools."));
        }
        return await chatModel.invoke(msgs, { signal });
      }, resolvedOptions);

      let contentString = "";
      if (typeof (result as any).content === "string") contentString = (result as any).content;
      else if (Array.isArray((result as any).content)) contentString = (result as any).content.map((p: any) => (typeof p === "string" ? p : p?.text ?? String(p))).join("");
      else if ((result as any).content && typeof (result as any).content === "object") contentString = (result as any).content.text || (result as any).content.content || String((result as any).content);
      else contentString = String((result as any).content || "");

      // Check response metadata for error indicators (even if HTTP request succeeded)
      // Some providers return HTTP 200 but indicate errors via finish_reason or metadata
      // Note: "length" finish_reason is NOT an error - it's handled by retry logic below
      const responseMetadata = (result as any)?.response_metadata || {};
      const additionalKwargs = (result as any)?.additional_kwargs || {};
      const finishReason = responseMetadata?.finish_reason;
      const errorFinishReasons = ["content_filter", "error", "safety", "safety_ratings"];
      const hasErrorFinishReason = finishReason && errorFinishReasons.includes(String(finishReason).toLowerCase());
      const hasErrorInMetadata = responseMetadata?.error || additionalKwargs?.error;
      
      if (hasErrorFinishReason || hasErrorInMetadata) {
        // Treat as content filtering or provider error even though HTTP succeeded
        // Return early to prevent saving invalid content to CSV
        const errorMessage = hasErrorInMetadata 
          ? String(responseMetadata?.error || additionalKwargs?.error)
          : `Response finished with reason: ${finishReason}`;
        const categorized = categorizeLLMError(
          { message: errorMessage, finishReason, status: 200 },
          model,
        );
        console.warn(`[LLMService] processMessages response metadata indicates error`, {
          provider: model,
          finishReason,
          hasErrorInMetadata,
          category: categorized.category,
        });
        return {
          content: "",
          success: false,
          error: categorized.userMessage,
          categorizedError: categorized,
        };
      }

      // Return successful response - content will be saved to CSV by worker/server
      const totalElapsed = Date.now() - invokeStart;
      console.log(`[LLMService:${messageCallId}] processMessages:success`, {
        provider: model,
        modelId,
        totalElapsedMs: totalElapsed,
        contentLen: contentString.length,
        contentPreview: contentString.substring(0, 80),
        timestamp: new Date().toISOString(),
      });
      return { content: contentString, success: true };
    } catch (error: any) {
      const totalElapsed = Date.now() - invokeStart;
      // Categorize error for structured error handling
      const categorized = categorizeLLMError(error, model);
      console.error(`[LLMService:${messageCallId}] processMessages:error`, {
        provider: model,
        modelId,
        totalElapsedMs: totalElapsed,
        category: categorized.category,
        retryable: categorized.retryable,
        errorCode: getLLMErrorCode(categorized),
        technicalMessage: categorized.technicalMessage,
        rawErrorName: error?.name,
        rawErrorMessage: error?.message?.substring?.(0, 300),
        timestamp: new Date().toISOString(),
      });
      return {
        content: "",
        success: false,
        error: categorized.userMessage, // Use user-friendly message
        categorizedError: categorized,
      };
    }
  }

  private getOrCreateModel(provider: SupportedModel, modelId: string, requested: LLMServiceOptions = {}): BaseChatModel {
    // Build cache key with minimal cardinality while reflecting surface-level differences
    // Include token buckets so that retries with different max tokens use distinct clients
    let cacheKey = `${provider}:${modelId}`;
    if (provider === "openai") {
      const eff = computeOpenAIEffectiveParams(modelId, requested);
      const tempBucket = typeof eff.temperature === "number" ? `t${eff.temperature}` : "tNA";
      const effort = eff.reasoningEffort ? `e${eff.reasoningEffort}` : "eNA";
      const tokenBucket = typeof eff.maxTokens === "number" ? `m${eff.maxTokens}` : "mNA";
      const timeoutBucket = typeof requested.timeoutMs === "number" ? `x${requested.timeoutMs}` : "xNA";
      cacheKey = `${provider}:${modelId}:${eff.apiSurface}:${tempBucket}:${effort}:${tokenBucket}:${timeoutBucket}`;
    }
    const existing = this.models.get(cacheKey);
    if (existing) return existing;

    if (provider === "openai") {
      if (!this.apiKeys.openai) throw new Error("OpenAI API key not configured");
      // Compute effective params for OpenAI models based on capabilities
      const eff = computeOpenAIEffectiveParams(modelId, requested);
      console.log(`[OpenAIAdapter] params`, {
        provider,
        modelId,
        requested,
        effective: { temperature: eff.temperature, maxTokens: eff.maxTokens, reasoningEffort: eff.reasoningEffort, apiSurface: eff.apiSurface },
        sanitizedFields: eff.sanitizedFields,
      });
      // For now, we stay on ChatOpenAI; Responses-specific fields are managed by LangChain under the hood for supported models
      const model = new ChatOpenAI({
        apiKey: this.apiKeys.openai,
        model: modelId,
        temperature: eff.temperature,
        maxTokens: eff.maxTokens ?? 512,
        timeout: requested.timeoutMs ?? 10000,
        maxRetries: requested.maxRetries ?? 2,
      });
      this.models.set(cacheKey, model);
      return model;
    }

    if (provider === "gemini") {
      if (!this.apiKeys.gemini) throw new Error("Gemini API key not configured");
      const eff = computeGeminiEffectiveParams(modelId, requested);
      const tokenBucket = typeof eff.maxOutputTokens === "number" ? `m${eff.maxOutputTokens}` : "mNA";
      const timeoutBucket = typeof requested.timeoutMs === "number" ? `x${requested.timeoutMs}` : "xNA";
      const gemCacheKey = `${provider}:${modelId}:chat:t${typeof eff.temperature === "number" ? eff.temperature : "NA"}:${tokenBucket}:${timeoutBucket}`;
      const existingGem = this.models.get(gemCacheKey);
      if (existingGem) return existingGem;
      console.log(`[GeminiAdapter] params`, {
        provider,
        modelId,
        requested,
        effective: { temperature: eff.temperature, maxOutputTokens: eff.maxOutputTokens, apiSurface: eff.apiSurface },
        sanitizedFields: eff.sanitizedFields,
      });
      const model = new ChatGoogleGenerativeAI({
        apiKey: this.apiKeys.gemini,
        model: modelId,
        temperature: eff.temperature,
        maxOutputTokens: eff.maxOutputTokens ?? 512,
        // Disable Gemini safety blocking for enrichment (user-requested)
        // Category names and thresholds per Gemini API
        safetySettings: [
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ] as any,
      }) as unknown as BaseChatModel;
      this.models.set(gemCacheKey, model);
      return model;
    }

    if (provider === "perplexity") {
      if (!this.apiKeys.perplexity) throw new Error("Perplexity API key not configured");
      const eff = computePerplexityEffectiveParams(modelId, requested);
      const tokenBucket = typeof eff.maxTokens === "number" ? `m${eff.maxTokens}` : "mNA";
      const timeoutBucket = typeof requested.timeoutMs === "number" ? `x${requested.timeoutMs}` : "xNA";
      const perpCacheKey = `${provider}:${modelId}:chat:t${typeof eff.temperature === "number" ? eff.temperature : "NA"}:${tokenBucket}:${timeoutBucket}`;
      const existingPerp = this.models.get(perpCacheKey);
      if (existingPerp) return existingPerp;
      console.log(`[PerplexityAdapter] params`, {
        provider,
        modelId,
        requested,
        effective: { temperature: eff.temperature, maxTokens: eff.maxTokens, apiSurface: eff.apiSurface },
        sanitizedFields: eff.sanitizedFields,
      });
      const model = new ChatPerplexity({
        apiKey: this.apiKeys.perplexity,
        model: modelId,
        temperature: eff.temperature,
        maxTokens: eff.maxTokens ?? 512,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        maxRetries: requested.maxRetries ?? 2,
        // Default to web search for enrichment per Perplexity guide
        // Note: LangChain's ChatPerplexity forwards unknown fields via extra_body
        searchMode: eff.searchMode,
      });
      this.models.set(perpCacheKey, model);
      return model;
    }

    if (provider === "deepseek") {
      if (!this.apiKeys.deepseek) throw new Error("DeepSeek API key not configured");
      // DeepSeek uses OpenAI-compatible API; treat chat vs reasoner deterministically
      const isReasoner = modelId === "deepseek-reasoner";
      const temperature = isReasoner ? undefined : (typeof requested.temperature === "number" ? requested.temperature : 0);
      const model = new ChatOpenAI({
        apiKey: this.apiKeys.deepseek,
        // Route OpenAI-compatible client to DeepSeek endpoint
        configuration: { baseURL: "https://api.deepseek.com" } as any,
        model: modelId,
        temperature,
        maxTokens: requested.maxTokens,
        timeout: requested.timeoutMs ?? 10000,
        maxRetries: requested.maxRetries ?? 2,
      });
      this.models.set(cacheKey, model);
      return model;
    }

    if (provider === "anthropic") {
      if (!this.apiKeys.anthropic) throw new Error("Anthropic API key not configured");
      const temperature = typeof requested.temperature === "number" ? requested.temperature : 0;
      const model = new ChatAnthropic({
        apiKey: this.apiKeys.anthropic,
        model: modelId,
        temperature,
        maxTokens: requested.maxTokens ?? 1024,
        timeout: requested.timeoutMs ?? 10000,
        maxRetries: requested.maxRetries ?? 2,
      });
      this.models.set(cacheKey, model);
      return model;
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  /**
   * Process a prompt using the specified model with LangChain integration
   * Maintains the same interface while leveraging LangChain's capabilities
   */
  async processPrompt(
    prompt: string,
    model: SupportedModel,
    options: LLMServiceOptions & { modelId?: string } = {},
  ): Promise<LLMResponse> {
    // Require explicit modelId; no provider defaults for job/preview flows
    const modelId = options.modelId;
    if (!modelId) {
      return { content: "", success: false, error: `Missing modelId for provider ${model}` };
    }
    // Remove prompt-length based maxTokens heuristic; respect caller/defaults
    const promptLength = typeof prompt === "string" ? prompt.length : 0;
    // Scale timeout with prompt length to reduce request aborts; prefer caller's value when higher
    const heuristicTimeout = (() => {
      if (promptLength > 12000) return Math.max(options.timeoutMs ?? 0, 45000);
      if (promptLength > 8000) return Math.max(options.timeoutMs ?? 0, 30000);
      if (promptLength > 4000) return Math.max(options.timeoutMs ?? 0, 20000);
      return options.timeoutMs;
    })();
    const resolvedOptions = { ...options, timeoutMs: heuristicTimeout };
    console.log(`[LLMService] token planning`, {
      provider: model,
      modelId,
      promptLength,
      requestedMaxTokens: options.maxTokens,
      effectiveMaxTokens: options.maxTokens,
    });

    const chatModel = this.getOrCreateModel(model, modelId, resolvedOptions);
    console.log(`[LLMService] Using provider/model`, { provider: model, modelId });

    try {
      // Use our timeout and retry wrapper for additional reliability
      const result = await this.withTimeoutAndRetries(async (signal) => {
        const messages = [new HumanMessage({ content: prompt })];
        if (model === "gemini") {
          messages.unshift(new SystemMessage("Reply in plain text only. Do not call any tools."));
        }
        // LangChain models handle their own configuration, we pass signal for cancellation
        const response = await chatModel.invoke(messages, { signal });
        return response;
      }, resolvedOptions);

      // Ensure content is always a string, handling different LangChain response formats
      console.log(`[LLMService] Processing ${model} response:`, {
        originalContentType: typeof result.content,
        originalContent: result.content,
        isArray: Array.isArray(result.content),
        resultKeys: result && typeof result === "object" ? Object.keys(result) : "not object",
        additional: (result as any)?.additional_kwargs,
        finishReason: (result as any)?.response_metadata?.finish_reason,
      });

      // Perplexity search auditing: log whether search was used and number of sources
      if (model === "perplexity") {
        const ak = (result as any)?.additional_kwargs || {};
        const rm = (result as any)?.response_metadata || {};
        const sr = ak?.search_results || rm?.search_results || (result as any)?.search_results;
        const count = Array.isArray(sr) ? sr.length : 0;
        const usedSearch = count > 0 || typeof rm?.usage?.search_context_size === "number";
        const searchMode = rm?.search_mode || ak?.search_mode;
        console.log(`[PerplexityAdapter] search audit`, {
          usedSearch,
          searchResultsCount: count,
          searchMode,
        });
      }

      let contentString = "";
      if (typeof result.content === "string") {
        contentString = result.content;
        console.log(`[LLMService] Content is string, length: ${contentString.length}`);
      } else if (Array.isArray(result.content)) {
        // Handle array of content parts (multimodal responses)
        console.log(`[LLMService] Content array details:`, {
          arrayLength: result.content.length,
          arrayItems: result.content.map((part, i) => ({
            index: i,
            type: typeof part,
            value: part,
            keys: part && typeof part === "object" ? Object.keys(part) : "not object",
          })),
        });

        contentString = result.content
          .map((part) => {
            if (typeof part === "string") {
              return part;
            } else if (part && typeof part === "object") {
              // Handle different content part types safely
              return (part as any).text || String(part);
            }
            return String(part);
          })
          .join("");
        console.log(
          `[LLMService] Content is array, joined to string length: ${contentString.length}`,
        );

        // If Gemini returned empty content array, log safety metadata but do not override content
        if (model === "gemini" && contentString.length === 0 && result.content.length === 0) {
          const responseMetadata = (result as any).response_metadata || {};
          console.log(`[LLMService] Gemini empty content array`, { responseMetadata });
        }
      } else if (result.content && typeof result.content === "object") {
        // Handle object content safely
        const contentObj = result.content as any;
        contentString = contentObj.text || contentObj.content || String(result.content);
        console.log(
          `[LLMService] Content is object, extracted string length: ${contentString.length}`,
        );
      } else {
        contentString = String(result.content || "");
        console.log(`[LLMService] Content fallback to string, length: ${contentString.length}`);
      }

      console.log(`[LLMService] Final content string:`, {
        length: contentString.length,
        preview: contentString.substring(0, 100),
      });

      // Check response metadata for error indicators (even if HTTP request succeeded)
      // Some providers return HTTP 200 but indicate errors via finish_reason or metadata
      // Note: "length" finish_reason is NOT an error - it's handled by retry logic below
      const responseMetadata = (result as any)?.response_metadata || {};
      const additionalKwargs = (result as any)?.additional_kwargs || {};
      const finishReason = responseMetadata?.finish_reason;
      const errorFinishReasons = ["content_filter", "error", "safety", "safety_ratings"];
      const hasErrorFinishReason = finishReason && errorFinishReasons.includes(String(finishReason).toLowerCase());
      const hasErrorInMetadata = responseMetadata?.error || additionalKwargs?.error;
      
      if (hasErrorFinishReason || hasErrorInMetadata) {
        // Treat as content filtering or provider error even though HTTP succeeded
        // Return early to prevent saving invalid content to CSV
        const errorMessage = hasErrorInMetadata 
          ? String(responseMetadata?.error || additionalKwargs?.error)
          : `Response finished with reason: ${finishReason}`;
        const categorized = categorizeLLMError(
          { message: errorMessage, finishReason, status: 200 },
          model,
        );
        console.warn(`[LLMService] processPrompt response metadata indicates error`, {
          provider: model,
          finishReason,
          hasErrorInMetadata,
          category: categorized.category,
        });
        return {
          content: "",
          success: false,
          error: categorized.userMessage,
          categorizedError: categorized,
        };
      }
      
      // Continue with existing retry logic for edge cases (tool calls, empty content, length)
      const invalidToolCalls = Array.isArray(additionalKwargs?.metadata)
        ? additionalKwargs.metadata.includes("invalid_tool_calls")
        : additionalKwargs?.invalid_tool_calls === true || additionalKwargs?.reason === "invalid_tool_calls";
      if (!contentString && (invalidToolCalls || Array.isArray(additionalKwargs?.tool_calls))) {
        console.warn(`[LLMService] Empty content with tool/invalid_tool_calls; retrying with plain-text nudge`, {
          provider: model,
          modelId,
          hasToolCalls: Array.isArray(additionalKwargs?.tool_calls),
          invalidToolCalls,
        });

        const retryMessage = new HumanMessage({ content: `${prompt}\n\nAnswer in plain text only. Do not call any tools.` });
        const retry = await this.withTimeoutAndRetries(async (signal) => {
          const response = await chatModel.invoke([retryMessage], { signal });
          return response;
        }, { ...options });

        let retryText = "";
        if (typeof (retry as any).content === "string") retryText = (retry as any).content;
        else if (Array.isArray((retry as any).content)) retryText = (retry as any).content.map((p: any) => (typeof p === "string" ? p : p?.text ?? String(p))).join("");
        else if ((retry as any).content && typeof (retry as any).content === "object") retryText = (retry as any).content.text || (retry as any).content.content || String((retry as any).content);
        else retryText = String((retry as any).content || "");

        return { content: retryText, success: true };
      }

      // Fallback: if empty content and tool_calls detected, retry once nudging plain-text output
      const toolCalls = (result as any)?.additional_kwargs?.tool_calls;
      const hadToolOnly = !contentString && Array.isArray(toolCalls) && toolCalls.length > 0;
      if (hadToolOnly) {
        console.warn(`[LLMService] Empty content with tool_calls detected; retrying with plain-text nudge`, {
          provider: model,
          modelId,
          toolCallsCount: toolCalls.length,
        });

        const retryMessage = new HumanMessage({ content: `${prompt}\n\nPlease answer in plain text. Do not call any tools.` });
        const retry = await this.withTimeoutAndRetries(async (signal) => {
          const response = await chatModel.invoke([retryMessage], { signal });
          return response;
        }, options);

        let retryText = "";
        if (typeof (retry as any).content === "string") retryText = (retry as any).content;
        else if (Array.isArray((retry as any).content)) retryText = (retry as any).content.map((p: any) => (typeof p === "string" ? p : p?.text ?? String(p))).join("");
        else if ((retry as any).content && typeof (retry as any).content === "object") retryText = (retry as any).content.text || (retry as any).content.content || String((retry as any).content);
        else retryText = String((retry as any).content || "");

        return { content: retryText, success: true };
      }

      // If the model stopped due to length and content is empty, try a continuation with higher max tokens
      if (!contentString && finishReason === "length") {
        const currentMax = typeof resolvedOptions.maxTokens === "number" ? resolvedOptions.maxTokens : undefined;
        const bumped = currentMax ? Math.min(currentMax * 2, 4096) : 1024;
        console.warn(`[LLMService] Empty content with finish_reason=length; retrying with higher max tokens`, { currentMax, bumped });
        const followupModel = this.getOrCreateModel(model, modelId, { ...options, maxTokens: bumped });
        const continuePrompt = `${prompt}\n\nIf you were cut off, continue your answer in plain text.`;
        const retry = await this.withTimeoutAndRetries(async (signal) => {
          const response = await followupModel.invoke([new HumanMessage({ content: continuePrompt })], { signal });
          return response;
        }, { ...options, maxTokens: bumped });

        let retryText = "";
        if (typeof (retry as any).content === "string") retryText = (retry as any).content;
        else if (Array.isArray((retry as any).content)) retryText = (retry as any).content.map((p: any) => (typeof p === "string" ? p : p?.text ?? String(p))).join("");
        else if ((retry as any).content && typeof (retry as any).content === "object") retryText = (retry as any).content.text || (retry as any).content.content || String((retry as any).content);
        else retryText = String((retry as any).content || "");

        if (retryText) return { content: retryText, success: true };
      }

      // Gemini fallback: if empty content, retry once with stronger plain-text instruction
      if (model === "gemini" && !contentString) {
        console.warn(`[LLMService] Gemini empty content; retrying with stronger plain-text instruction`);
        const retryMessages = [
          new SystemMessage("Reply in plain text only. Do not call any tools. Provide a concise answer."),
          new HumanMessage({ content: prompt }),
        ];
        const retry = await this.withTimeoutAndRetries(async (signal) => {
          const response = await chatModel.invoke(retryMessages, { signal });
          return response;
        }, options);

        let retryText = "";
        if (typeof (retry as any).content === "string") retryText = (retry as any).content;
        else if (Array.isArray((retry as any).content)) retryText = (retry as any).content.map((p: any) => (typeof p === "string" ? p : p?.text ?? String(p))).join("");
        else if ((retry as any).content && typeof (retry as any).content === "object") retryText = (retry as any).content.text || (retry as any).content.content || String((retry as any).content);
        else retryText = String((retry as any).content || "");

        return { content: retryText, success: true };
      }

      return {
        content: contentString,
        success: true,
      };
    } catch (error: any) {
      // Categorize error first to enable structured error handling
      const categorizedError = categorizeLLMError(error, model);
      const messageText = (error?.message || "").toString();
      const isUnsupportedParam = categorizedError.category === "UNSUPPORTED_PARAMETER" || /Unsupported|does not support|Only the default/i.test(messageText);
      const isTokenLimitError = categorizedError.category === "TOKEN_LIMIT" || /max tokens|maximum tokens|too many tokens|exceeds.*token/i.test(messageText);
      
      // One-time sanitize+retry for OpenAI unsupported-parameter style errors
      if (model === "openai" && isUnsupportedParam) {
        console.warn(`[OpenAIAdapter] retrying after sanitizing unsupported params`, {
          modelId,
          requested: options,
          error: messageText,
        });
        const fallbackOptions = { ...options };
        delete (fallbackOptions as any).temperature;
        try {
          const retriedModel = this.getOrCreateModel(model, modelId, fallbackOptions);
          const result = await this.withTimeoutAndRetries(async (signal) => {
            const message = new HumanMessage({ content: prompt });
            const response = await retriedModel.invoke([message], { signal });
            return response;
          }, fallbackOptions);

          // Normalize result content as above
          let contentString = "";
          if (typeof (result as any).content === "string") {
            contentString = (result as any).content;
          } else if (Array.isArray((result as any).content)) {
            contentString = (result as any).content
              .map((part: any) => (typeof part === "string" ? part : part?.text ?? String(part)))
              .join("");
          } else if ((result as any).content && typeof (result as any).content === "object") {
            const contentObj = (result as any).content as any;
            contentString = contentObj.text || contentObj.content || String((result as any).content);
          } else {
            contentString = String((result as any).content || "");
          }

          return { content: contentString, success: true };
        } catch (retryErr: any) {
          const categorized = categorizeLLMError(retryErr, model);
          console.error(`[LLMService] processPrompt unsupported-param retry failed`, {
            provider: model,
            category: categorized.category,
            errorCode: getLLMErrorCode(categorized),
            technicalMessage: categorized.technicalMessage,
          });
          return {
            content: "",
            success: false,
            error: categorized.userMessage,
            categorizedError: categorized,
          };
        }
      }

      // Generic token-limit fallback: retry once with 75% of requested max tokens
      const currentRequestedMax = typeof options.maxTokens === "number" ? options.maxTokens : undefined;
      if (isTokenLimitError && currentRequestedMax && currentRequestedMax > 1) {
        const reduced = Math.max(1, Math.floor(currentRequestedMax * 0.75));
        console.warn(`[LLMService] Token-limit error; retrying with reduced maxTokens`, {
          provider: model,
          modelId,
          requested: currentRequestedMax,
          reduced,
        });
        try {
          const retriedModel = this.getOrCreateModel(model, modelId, { ...options, maxTokens: reduced });
          const retryResult = await this.withTimeoutAndRetries(async (signal) => {
            const message = new HumanMessage({ content: prompt });
            const response = await retriedModel.invoke([message], { signal });
            return response;
          }, { ...options, maxTokens: reduced });

          let contentString = "";
          if (typeof (retryResult as any).content === "string") contentString = (retryResult as any).content;
          else if (Array.isArray((retryResult as any).content)) contentString = (retryResult as any).content.map((p: any) => (typeof p === "string" ? p : p?.text ?? String(p))).join("");
          else if ((retryResult as any).content && typeof (retryResult as any).content === "object") contentString = (retryResult as any).content.text || (retryResult as any).content.content || String((retryResult as any).content);
          else contentString = String((retryResult as any).content || "");

          return { content: contentString, success: true };
        } catch (retryErr: any) {
          const categorizedRetry = categorizeLLMError(retryErr, model);
          console.error(`[LLMService] Reduced maxTokens retry failed`, {
            provider: model,
            category: categorizedRetry.category,
            errorCode: getLLMErrorCode(categorizedRetry),
            technicalMessage: categorizedRetry.technicalMessage,
          });
          // continue to generic error return below
        }
      }

      // Use categorized error for final return (may have been set above, or categorize now)
      const finalCategorized = categorizeLLMError(error, model);
      console.error(`[LLMService] processPrompt final error`, {
        provider: model,
        category: finalCategorized.category,
        retryable: finalCategorized.retryable,
        errorCode: getLLMErrorCode(finalCategorized),
        technicalMessage: finalCategorized.technicalMessage,
      });
      return {
        content: "",
        success: false,
        error: finalCategorized.userMessage,
        categorizedError: finalCategorized,
      };
    }
  }

  /**
   * Timeout and retry wrapper for LangChain models
   */
  private async withTimeoutAndRetries<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    options: LLMServiceOptions,
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? 10000;
    const maxRetries = options.maxRetries ?? 2;
    const callId = Math.random().toString(36).substring(2, 8);

    console.log(`[LLMService:${callId}] withTimeoutAndRetries:start`, {
      timeoutMs,
      maxRetries,
      timestamp: new Date().toISOString(),
    });

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const attemptStart = Date.now();
      const timer = setTimeout(() => {
        console.log(`[LLMService:${callId}] TIMEOUT_TRIGGERED attempt=${attempt}`, {
          elapsedMs: Date.now() - attemptStart,
          timeoutMs,
          timestamp: new Date().toISOString(),
        });
        controller.abort();
      }, timeoutMs);

      console.log(`[LLMService:${callId}] attempt:${attempt}:start`, {
        timeoutMs,
        timestamp: new Date().toISOString(),
      });

      try {
        const result = await fn(controller.signal);
        clearTimeout(timer);
        const elapsedMs = Date.now() - attemptStart;
        console.log(`[LLMService:${callId}] attempt:${attempt}:success`, {
          elapsedMs,
          timeoutMs,
          headroom: timeoutMs - elapsedMs,
          timestamp: new Date().toISOString(),
        });
        return result;
      } catch (error) {
        clearTimeout(timer);
        const elapsedMs = Date.now() - attemptStart;
        lastError = error;

        const status = (error as any)?.status as number | undefined;
        const isAbortError = (error as any)?.name === "AbortError";
        const isRateLimitError = status === 429;
        const isServerError = typeof status === "number" && status >= 500;
        const isConnectionError =
          (error as any)?.code === "ECONNRESET" || (error as any)?.code === "ETIMEDOUT";

        const isRetryable = isAbortError || isRateLimitError || isServerError || isConnectionError;

        console.log(`[LLMService:${callId}] attempt:${attempt}:failed`, {
          elapsedMs,
          timeoutMs,
          isAbortError,
          isRateLimitError,
          isServerError,
          isConnectionError,
          isRetryable,
          errorName: (error as any)?.name,
          errorCode: (error as any)?.code,
          errorStatus: status,
          errorMessage: (error as any)?.message?.substring?.(0, 200),
          timestamp: new Date().toISOString(),
        });

        if (!isRetryable || attempt === maxRetries) {
          console.log(`[LLMService:${callId}] giving_up`, {
            attempt,
            maxRetries,
            isRetryable,
            finalErrorName: (error as any)?.name,
            finalErrorMessage: (error as any)?.message?.substring?.(0, 200),
          });
          break;
        }

        // Exponential backoff with jitter
        const baseDelay = 500 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 200);
        console.log(`[LLMService:${callId}] retry_backoff`, {
          attempt,
          nextAttempt: attempt + 1,
          backoffMs: baseDelay + jitter,
        });
        await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));

        attempt += 1;
      }
    }

    throw lastError;
  }

  /**
   * Update API keys and reinitialize models
   */
  public updateApiKeys(newApiKeys: Record<string, string>): void {
    this.apiKeys = { ...this.apiKeys, ...newApiKeys };
    this.models.clear();
  }

  /**
   * Get available models based on configured API keys
   */
  public getAvailableModels(): SupportedModel[] {
    return (Object.keys(this.apiKeys) as SupportedModel[]).filter((p) => Boolean(this.apiKeys[p]));
  }

  /**
   * Health check for individual models
   */
  public async healthCheck(model: SupportedModel): Promise<boolean> {
    try {
      const first = getModelsForProvider(model)[0];
      if (!first) return false;
      const result = await this.processPrompt("Hello", model, { timeoutMs: 5000, maxTokens: 10, modelId: first.id });
      return result.success;
    } catch {
      return false;
    }
  }
}
