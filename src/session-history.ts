/**
 * Session History API
 * 
 * This module provides public APIs for retrieving historical messages from
 * resumed Claude Code sessions. When you resume a session, you can now
 * programmatically access the full conversation history.
 * 
 * @module session-history
 */

import { parseSessionTranscript, streamSessionTranscript, getSessionMetadata, TranscriptParser } from './_internal/transcript-parser';
import type { TranscriptParseOptions } from './_internal/types';

/**
 * Retrieve the complete message history from a session.
 * 
 * This function returns all historical messages from a session in chronological
 * order. The messages are in the same format as messages streamed from query(),
 * making it easy to analyze or display completed sessions.
 * 
 * @param sessionId - The session ID (can be obtained from SDKMessage.session_id)
 * @param options - Optional parsing configuration
 * @returns Promise<Array> of SDK messages from the session
 * 
 * @example
 * ```typescript
 * import { getSessionHistory } from '@anthropic-ai/claude-agent-sdk';
 * 
 * // Get all historical messages
 * const history = await getSessionHistory('34e94925-f4cc-4685-8869-83c77062ad14');
 * 
 * history.forEach(message => {
 *   if (message.type === 'user') {
 *     console.log('User:', message.message.content);
 *   } else if (message.type === 'assistant') {
 *     console.log('Assistant:', message.message.content);
 *   }
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Filter to only conversation messages
 * const conversation = await getSessionHistory(sessionId, {
 *   filterTypes: ['user', 'assistant']
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Resume from a specific message
 * const recentHistory = await getSessionHistory(sessionId, {
 *   resumeFromMessageId: 'msg_123abc'
 * });
 * ```
 */
export async function getSessionHistory(
  sessionId: string,
  options?: Omit<TranscriptParseOptions, 'markAsReplay'> & { cwd?: string }
): Promise<any[]> {
  const { cwd, ...parseOptions } = options || {};
  return parseSessionTranscript(sessionId, { ...parseOptions, markAsReplay: true }, cwd);
}

/**
 * Stream historical messages from a session one at a time.
 * 
 * This is a memory-efficient alternative to getSessionHistory() that yields
 * messages as an async generator. Useful for processing large session histories
 * without loading everything into memory at once.
 * 
 * @param sessionId - The session ID
 * @param options - Optional parsing configuration
 * @yields SDK messages from the session
 * 
 * @example
 * ```typescript
 * import { streamSessionHistory } from '@anthropic-ai/claude-agent-sdk';
 * 
 * for await (const message of streamSessionHistory('session-id')) {
 *   processMessage(message);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Filter while streaming
 * for await (const message of streamSessionHistory('session-id', {
 *   filterTypes: ['user', 'assistant']
 * })) {
 *   if (message.type === 'user' && message.isReplay) {
 *     console.log('Historical user message:', message.message.content);
 *   }
 * }
 * ```
 */
export async function* streamSessionHistory(
  sessionId: string,
  options?: Omit<TranscriptParseOptions, 'markAsReplay'> & { cwd?: string }
): AsyncGenerator<any, void, unknown> {
  const { cwd, ...parseOptions } = options || {};
  yield* streamSessionTranscript(sessionId, { ...parseOptions, markAsReplay: true }, cwd);
}

/**
 * Get metadata about a session without loading all messages.
 * 
 * This is useful for displaying session information in a UI or deciding
 * whether to load a session's full history.
 * 
 * @param sessionId - The session ID
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Session metadata
 * 
 * @example
 * ```typescript
 * import { getSessionInfo } from '@anthropic-ai/claude-agent-sdk';
 * 
 * const info = await getSessionInfo('session-id');
 * console.log(`Session has ${info.messageCount} messages`);
 * console.log(`Started: ${new Date(info.firstTimestamp)}`);
 * console.log(`Ended: ${new Date(info.lastTimestamp)}`);
 * ```
 */
export async function getSessionInfo(
  sessionId: string,
  cwd?: string
) {
  return getSessionMetadata(sessionId, cwd);
}

/**
 * Check if a session's transcript exists.
 * 
 * This is useful for validating session IDs before attempting to load history.
 * 
 * @param sessionId - The session ID
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns True if the session transcript exists on disk
 * 
 * @example
 * ```typescript
 * import { sessionExists } from '@anthropic-ai/claude-agent-sdk';
 * 
 * if (await sessionExists('session-id')) {
 *   const history = await getSessionHistory('session-id');
 * } else {
 *   console.log('Session not found');
 * }
 * ```
 */
export function sessionExists(
  sessionId: string,
  cwd?: string
): boolean {
  return TranscriptParser.transcriptExists(sessionId, cwd);
}

/**
 * Get the file system path to a session's transcript.
 * 
 * This can be useful for advanced use cases where you need direct file access.
 * The transcript is a JSONL file where each line is a JSON-serialized SDK message.
 * 
 * @param sessionId - The session ID
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Absolute path to the transcript file
 * 
 * @example
 * ```typescript
 * import { getSessionTranscriptPath } from '@anthropic-ai/claude-agent-sdk';
 * 
 * const path = getSessionTranscriptPath('session-id');
 * // /home/user/.claude/projects/workspace/session-id.jsonl
 * ```
 */
export function getSessionTranscriptPath(
  sessionId: string,
  cwd?: string
): string {
  return TranscriptParser.getTranscriptPath(sessionId, cwd);
}
