/**
 * Claude Agent SDK - Session History Module
 * 
 * This module extends the Claude Agent SDK with APIs for retrieving
 * historical messages from resumed sessions.
 */

export {
  getSessionHistory,
  streamSessionHistory,
  getSessionInfo,
  sessionExists,
  getSessionTranscriptPath
} from './session-history';

export type { TranscriptParseOptions } from './_internal/types';

// Re-export main SDK types for convenience
export type {
  SDKMessage,
  SDKUserMessage,
  SDKUserMessageReplay,
  SDKAssistantMessage,
  SDKSystemMessage,
  SDKResultMessage,
  SDKPartialAssistantMessage
} from '@anthropic-ai/claude-agent-sdk';
