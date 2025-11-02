/**
 * Internal types for transcript parsing.
 * These represent the raw format stored in JSONL transcript files.
 */

/**
 * Base transcript message interface
 */
export interface TranscriptMessage {
  type: string;
  timestamp?: string;
  [key: string]: any;
}

/**
 * User message in transcript format
 */
export interface TranscriptUserMessage extends TranscriptMessage {
  type: 'user';
  content: string;
  timestamp: string;
}

/**
 * Assistant message in transcript format
 */
export interface TranscriptAssistantMessage extends TranscriptMessage {
  type: 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

/**
 * System message in transcript format
 */
export interface TranscriptSystemMessage extends TranscriptMessage {
  type: 'system';
  content: string;
  timestamp: string;
}

/**
 * Tool use message in transcript format
 */
export interface TranscriptToolUseMessage extends TranscriptMessage {
  type: 'tool_use';
  tool_name: string;
  tool_input: any;
  tool_use_id: string;
  timestamp: string;
}

/**
 * Tool result message in transcript format
 */
export interface TranscriptToolResultMessage extends TranscriptMessage {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
  timestamp: string;
}

/**
 * Meta message (should be filtered out)
 */
export interface TranscriptMetaMessage extends TranscriptMessage {
  type: 'meta';
  meta_type: string;
  data?: any;
}

/**
 * File snapshot message (should be filtered out by default)
 */
export interface TranscriptFileSnapshotMessage extends TranscriptMessage {
  type: 'file_snapshot';
  file_path: string;
  content: string;
  timestamp: string;
}

/**
 * Union type for all transcript message types
 */
export type AnyTranscriptMessage =
  | TranscriptUserMessage
  | TranscriptAssistantMessage
  | TranscriptSystemMessage
  | TranscriptToolUseMessage
  | TranscriptToolResultMessage
  | TranscriptMetaMessage
  | TranscriptFileSnapshotMessage;

/**
 * SDK Message types that are exposed to users
 */
export interface SDKUserMessage {
  type: 'user';
  content: string;
  timestamp: string;
  isReplay?: boolean;
}

export interface SDKAssistantMessage {
  type: 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  isReplay?: boolean;
}

export interface SDKSystemMessage {
  type: 'system';
  content: string;
  timestamp: string;
  skills?: string[];
  isReplay?: boolean;
}

export interface SDKToolUseMessage {
  type: 'tool_use';
  toolName: string;
  toolInput: any;
  toolUseId: string;
  timestamp: string;
  isReplay?: boolean;
}

export interface SDKToolResultMessage {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
  timestamp: string;
  isReplay?: boolean;
}

export interface SDKResultMessage {
  type: 'result';
  success: boolean;
  error?: string;
  timestamp: string;
}

/**
 * Union type for all SDK message types
 */
export type SDKMessage =
  | SDKUserMessage
  | SDKAssistantMessage
  | SDKSystemMessage
  | SDKToolUseMessage
  | SDKToolResultMessage
  | SDKResultMessage;

/**
 * Options for parsing transcripts
 */
export interface TranscriptParseOptions {
  /**
   * Whether to include file snapshot messages
   * @default false
   */
  includeFileSnapshots?: boolean;

  /**
   * Whether to include meta messages
   * @default false
   */
  includeMetaMessages?: boolean;

  /**
   * Filter messages by type
   */
  filterTypes?: string[];

  /**
   * Mark messages as replay messages
   * @default true
   */
  markAsReplay?: boolean;

  /**
   * Resume from a specific message ID
   */
  resumeFromMessageId?: string;
}
