/**
 * Transcript Parser
 * 
 * Parses JSONL transcript files from Claude Code sessions and converts them
 * to SDK message format. The transcript files are stored in ~/.claude/projects/
 * and contain the full conversation history including user messages, assistant
 * messages, system messages, tool uses, and results.
 * 
 * This module provides utilities similar to Python SDK's message parsing,
 * but specifically for reading historical session transcripts from disk.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import * as os from 'os';
import type { TranscriptLine, TranscriptParseOptions } from './types';

// Re-export SDK message types from the main SDK package
// Users should import from the main package, not from this internal module
export type {
  SDKMessage,
  SDKUserMessage,
  SDKUserMessageReplay,
  SDKAssistantMessage,
  SDKSystemMessage,
  SDKResultMessage,
  SDKPartialAssistantMessage,
  SDKCompactBoundaryMessage,
  SDKHookResponseMessage,
  SDKToolProgressMessage,
  SDKAuthStatusMessage
} from '@anthropic-ai/claude-agent-sdk';

/**
 * TranscriptParser class for reading and parsing Claude Code session transcripts.
 * 
 * The transcript files are JSONL format where each line is a JSON-serialized
 * SDK message exactly as it was generated during the session.
 */
export class TranscriptParser {
  /**
   * Parse a transcript file from a given path.
   * 
   * This reads the JSONL transcript file and returns an array of SDK messages.
   * The messages are returned in chronological order as they occurred in the session.
   * 
   * @param transcriptPath - Absolute path to the transcript JSONL file
   * @param options - Parsing options
   * @returns Array of SDK messages from the transcript
   * 
   * @example
   * ```typescript
   * const messages = await TranscriptParser.parseTranscriptFile(
   *   '/home/user/.claude/projects/workspace/session-id.jsonl'
   * );
   * ```
   */
  static async parseTranscriptFile(
    transcriptPath: string,
    options: TranscriptParseOptions = {}
  ): Promise<any[]> {
    const {
      includeFileSnapshots = false,
      includeMetaMessages = false,
      filterTypes = [],
      markAsReplay = true,
      resumeFromMessageId,
    } = options;

    const messages: any[] = [];
    
    // Check if file exists
    if (!fs.existsSync(transcriptPath)) {
      throw new Error(`Transcript file not found: ${transcriptPath}`);
    }

    // Read and parse JSONL file line by line
    const fileStream = fs.createReadStream(transcriptPath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let foundResumePoint = !resumeFromMessageId;

    try {
      for await (const line of rl) {
        // Skip empty lines
        if (!line.trim()) {
          continue;
        }

        try {
          const message: TranscriptLine = JSON.parse(line);

          // Check if we've reached the resume point
          if (resumeFromMessageId && !foundResumePoint) {
            if (this.getMessageId(message) === resumeFromMessageId) {
              foundResumePoint = true;
            }
            continue;
          }

          // Apply filters
          if (!this.shouldIncludeMessage(message, {
            includeFileSnapshots,
            includeMetaMessages,
            filterTypes
          })) {
            continue;
          }

          // Mark as replay if requested
          if (markAsReplay && message.type === 'user' && !message.isReplay) {
            message.isReplay = true;
          }

          messages.push(message);
        } catch (parseError) {
          // Log and skip malformed lines
          console.warn(`Failed to parse transcript line: ${parseError}`);
          continue;
        }
      }
    } finally {
      fileStream.close();
    }

    return messages;
  }

  /**
   * Get transcript path from session ID and current working directory.
   * 
   * The transcript path follows the pattern:
   * ~/.claude/projects/{project-slug}/{session-id}.jsonl
   * 
   * where project-slug is derived from the current working directory.
   * 
   * @param sessionId - The session ID (UUID)
   * @param cwd - Current working directory (defaults to process.cwd())
   * @returns Absolute path to the transcript file
   * 
   * @example
   * ```typescript
   * const path = TranscriptParser.getTranscriptPath(
   *   '34e94925-f4cc-4685-8869-83c77062ad14',
   *   '/home/user/my-project'
   * );
   * // Returns: /home/user/.claude/projects/home-user-my-project/34e94925-f4cc-4685-8869-83c77062ad14.jsonl
   * ```
   */
  static getTranscriptPath(sessionId: string, cwd: string = process.cwd()): string {
    const homeDir = os.homedir();
    const projectSlug = this.getProjectSlug(cwd);
    return path.join(homeDir, '.claude', 'projects', projectSlug, `${sessionId}.jsonl`);
  }

  /**
   * Generate project slug from current working directory.
   * 
   * The project slug is created by removing the leading slash and replacing
   * all remaining slashes with hyphens. This creates a unique identifier for
   * each project directory.
   * 
   * @param cwd - Current working directory
   * @returns Project slug
   * 
   * @example
   * ```typescript
   * TranscriptParser.getProjectSlug('/home/user/my-project')
   * // Returns: 'home-user-my-project'
   * 
   * TranscriptParser.getProjectSlug('/workspace')
   * // Returns: 'workspace'
   * ```
   */
  static getProjectSlug(cwd: string): string {
    // Convert path to slug by replacing slashes with hyphens
    // Remove leading slash and replace remaining slashes
    return cwd.replace(/^\//, '').replace(/\//g, '-');
  }

  /**
   * Check if a message should be included based on filter options.
   * 
   * @param message - Transcript message
   * @param options - Filter options
   * @returns True if message should be included
   */
  private static shouldIncludeMessage(
    message: TranscriptLine,
    options: {
      includeFileSnapshots: boolean;
      includeMetaMessages: boolean;
      filterTypes: string[];
    }
  ): boolean {
    const { includeFileSnapshots, includeMetaMessages, filterTypes } = options;

    // Check for file snapshots
    if (!includeFileSnapshots && message.type === 'file_snapshot') {
      return false;
    }

    // Check for meta messages
    if (!includeMetaMessages && message.type === 'meta') {
      return false;
    }

    // Check type filter
    if (filterTypes.length > 0 && !filterTypes.includes(message.type)) {
      return false;
    }

    return true;
  }

  /**
   * Extract message ID from transcript message (if available).
   * 
   * Messages can have IDs in different fields depending on their type:
   * - uuid: Most messages
   * - message.id: Assistant messages
   * - tool_use_id: Tool-related messages
   * 
   * @param message - Transcript message
   * @returns Message ID or undefined
   */
  private static getMessageId(message: TranscriptLine): string | undefined {
    // Check for uuid (most common)
    if (message.uuid) {
      return message.uuid;
    }

    // Check for message.id (assistant messages)
    if (message.message?.id) {
      return message.message.id;
    }

    // Check for tool_use_id
    if (message.tool_use_id) {
      return message.tool_use_id;
    }

    return undefined;
  }

  /**
   * Check if a transcript file exists for a given session.
   * 
   * @param sessionId - The session ID
   * @param cwd - Current working directory
   * @returns True if transcript exists
   * 
   * @example
   * ```typescript
   * const exists = TranscriptParser.transcriptExists('34e94925-f4cc-4685-8869-83c77062ad14');
   * if (exists) {
   *   const messages = await parseSessionTranscript('34e94925-f4cc-4685-8869-83c77062ad14');
   * }
   * ```
   */
  static transcriptExists(sessionId: string, cwd: string = process.cwd()): boolean {
    const transcriptPath = this.getTranscriptPath(sessionId, cwd);
    return fs.existsSync(transcriptPath);
  }

  /**
   * Get session metadata from transcript file without parsing all messages.
   * 
   * This is useful for getting summary information about a session without
   * loading the entire transcript into memory.
   * 
   * @param sessionId - The session ID
   * @param cwd - Current working directory
   * @returns Session metadata including message count and timestamps
   * 
   * @example
   * ```typescript
   * const metadata = await TranscriptParser.getSessionMetadata('session-id');
   * console.log(`Session has ${metadata.messageCount} messages`);
   * console.log(`Started at: ${metadata.firstTimestamp}`);
   * console.log(`Ended at: ${metadata.lastTimestamp}`);
   * ```
   */
  static async getSessionMetadata(
    sessionId: string,
    cwd: string = process.cwd()
  ): Promise<{
    sessionId: string;
    messageCount: number;
    firstTimestamp?: string;
    lastTimestamp?: string;
    transcriptPath: string;
  }> {
    const transcriptPath = this.getTranscriptPath(sessionId, cwd);
    
    if (!fs.existsSync(transcriptPath)) {
      throw new Error(`Transcript file not found: ${transcriptPath}`);
    }

    let messageCount = 0;
    let firstTimestamp: string | undefined;
    let lastTimestamp: string | undefined;

    const fileStream = fs.createReadStream(transcriptPath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;
        
        try {
          const message: TranscriptLine = JSON.parse(line);
          messageCount++;
          
          // Try to extract timestamp from various possible fields
          const timestamp = message.timestamp || 
                          message.message?.timestamp ||
                          message.created_at;
          
          if (timestamp) {
            if (!firstTimestamp) {
              firstTimestamp = timestamp;
            }
            lastTimestamp = timestamp;
          }
        } catch {
          // Skip malformed lines
        }
      }
    } finally {
      fileStream.close();
    }

    return {
      sessionId,
      messageCount,
      firstTimestamp,
      lastTimestamp,
      transcriptPath,
    };
  }

  /**
   * Stream messages from a transcript file as an async generator.
   * 
   * This is memory-efficient for large transcripts as it yields messages
   * one at a time instead of loading the entire file into memory.
   * 
   * @param transcriptPath - Path to transcript file
   * @param options - Parse options
   * @yields SDK messages from the transcript
   * 
   * @example
   * ```typescript
   * const transcriptPath = TranscriptParser.getTranscriptPath('session-id');
   * for await (const message of TranscriptParser.streamTranscriptMessages(transcriptPath)) {
   *   console.log(message.type, message);
   * }
   * ```
   */
  static async *streamTranscriptMessages(
    transcriptPath: string,
    options: TranscriptParseOptions = {}
  ): AsyncGenerator<any, void, unknown> {
    const {
      includeFileSnapshots = false,
      includeMetaMessages = false,
      filterTypes = [],
      markAsReplay = true,
      resumeFromMessageId,
    } = options;

    if (!fs.existsSync(transcriptPath)) {
      throw new Error(`Transcript file not found: ${transcriptPath}`);
    }

    const fileStream = fs.createReadStream(transcriptPath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let foundResumePoint = !resumeFromMessageId;

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const message: TranscriptLine = JSON.parse(line);

          if (resumeFromMessageId && !foundResumePoint) {
            if (this.getMessageId(message) === resumeFromMessageId) {
              foundResumePoint = true;
            }
            continue;
          }

          if (!this.shouldIncludeMessage(message, {
            includeFileSnapshots,
            includeMetaMessages,
            filterTypes
          })) {
            continue;
          }

          // Mark as replay if requested
          if (markAsReplay && message.type === 'user' && !message.isReplay) {
            message.isReplay = true;
          }

          yield message;
        } catch (parseError) {
          console.warn(`Failed to parse transcript line: ${parseError}`);
          continue;
        }
      }
    } finally {
      fileStream.close();
    }
  }
}

/**
 * Convenience function to parse a transcript file by session ID.
 * 
 * This automatically determines the transcript path from the session ID
 * and current working directory, then parses the transcript.
 * 
 * @param sessionId - Session ID
 * @param options - Parse options
 * @param cwd - Current working directory
 * @returns Array of SDK messages
 * 
 * @example
 * ```typescript
 * import { parseSessionTranscript } from '@anthropic-ai/claude-agent-sdk/_internal/transcript-parser';
 * 
 * const messages = await parseSessionTranscript('34e94925-f4cc-4685-8869-83c77062ad14');
 * 
 * // Filter to only user and assistant messages
 * const conversation = await parseSessionTranscript(
 *   'session-id',
 *   { filterTypes: ['user', 'assistant'] }
 * );
 * 
 * // Mark messages as replays
 * const historicalMessages = await parseSessionTranscript(
 *   'session-id',
 *   { markAsReplay: true }
 * );
 * ```
 */
export async function parseSessionTranscript(
  sessionId: string,
  options: TranscriptParseOptions = {},
  cwd: string = process.cwd()
): Promise<any[]> {
  const transcriptPath = TranscriptParser.getTranscriptPath(sessionId, cwd);
  return TranscriptParser.parseTranscriptFile(transcriptPath, options);
}

/**
 * Convenience function to stream transcript messages by session ID.
 * 
 * This is the async generator version of parseSessionTranscript(),
 * providing memory-efficient iteration over large transcripts.
 * 
 * @param sessionId - Session ID
 * @param options - Parse options
 * @param cwd - Current working directory
 * @yields SDK messages from the transcript
 * 
 * @example
 * ```typescript
 * import { streamSessionTranscript } from '@anthropic-ai/claude-agent-sdk/_internal/transcript-parser';
 * 
 * for await (const message of streamSessionTranscript('session-id')) {
 *   if (message.type === 'user') {
 *     console.log('User:', message.message.content);
 *   } else if (message.type === 'assistant') {
 *     console.log('Assistant:', message.message.content);
 *   }
 * }
 * ```
 */
export async function* streamSessionTranscript(
  sessionId: string,
  options: TranscriptParseOptions = {},
  cwd: string = process.cwd()
): AsyncGenerator<any, void, unknown> {
  const transcriptPath = TranscriptParser.getTranscriptPath(sessionId, cwd);
  yield* TranscriptParser.streamTranscriptMessages(transcriptPath, options);
}

/**
 * Get information about a session without loading all messages.
 * 
 * @param sessionId - Session ID
 * @param cwd - Current working directory
 * @returns Session metadata
 * 
 * @example
 * ```typescript
 * import { getSessionMetadata } from '@anthropic-ai/claude-agent-sdk/_internal/transcript-parser';
 * 
 * const metadata = await getSessionMetadata('session-id');
 * console.log(`Session has ${metadata.messageCount} messages`);
 * ```
 */
export async function getSessionMetadata(
  sessionId: string,
  cwd: string = process.cwd()
) {
  return TranscriptParser.getSessionMetadata(sessionId, cwd);
}
