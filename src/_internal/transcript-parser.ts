/**
 * Transcript Parser
 * 
 * Parses JSONL transcript files from Claude Code sessions and converts them
 * to SDK message format. Similar to Python SDK's _internal/message_parser.py
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import * as os from 'os';
import {
  AnyTranscriptMessage,
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKSystemMessage,
  SDKToolUseMessage,
  SDKToolResultMessage,
  TranscriptParseOptions,
  TranscriptUserMessage,
  TranscriptAssistantMessage,
  TranscriptSystemMessage,
  TranscriptToolUseMessage,
  TranscriptToolResultMessage,
} from './types';

/**
 * TranscriptParser class for reading and parsing Claude Code session transcripts
 */
export class TranscriptParser {
  /**
   * Parse a transcript file from a given path
   * 
   * @param transcriptPath - Absolute path to the transcript JSONL file
   * @param options - Parsing options
   * @returns Array of SDK messages
   */
  static async parseTranscriptFile(
    transcriptPath: string,
    options: TranscriptParseOptions = {}
  ): Promise<SDKMessage[]> {
    const {
      includeFileSnapshots = false,
      includeMetaMessages = false,
      filterTypes = [],
      markAsReplay = true,
      resumeFromMessageId,
    } = options;

    const messages: SDKMessage[] = [];
    
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
          const transcriptMessage: AnyTranscriptMessage = JSON.parse(line);

          // Check if we've reached the resume point
          if (resumeFromMessageId && !foundResumePoint) {
            if (this.getMessageId(transcriptMessage) === resumeFromMessageId) {
              foundResumePoint = true;
            }
            continue;
          }

          // Filter out unwanted message types
          if (!includeFileSnapshots && transcriptMessage.type === 'file_snapshot') {
            continue;
          }

          if (!includeMetaMessages && transcriptMessage.type === 'meta') {
            continue;
          }

          if (filterTypes.length > 0 && !filterTypes.includes(transcriptMessage.type)) {
            continue;
          }

          // Convert transcript message to SDK message format
          const sdkMessage = this.convertToSDKMessage(transcriptMessage, markAsReplay);
          
          if (sdkMessage) {
            messages.push(sdkMessage);
          }
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
   * Get transcript path from session ID and current working directory
   * 
   * @param sessionId - The session ID
   * @param cwd - Current working directory (defaults to process.cwd())
   * @returns Absolute path to the transcript file
   */
  static getTranscriptPath(sessionId: string, cwd: string = process.cwd()): string {
    const homeDir = os.homedir();
    const projectSlug = this.getProjectSlug(cwd);
    return path.join(homeDir, '.claude', 'projects', projectSlug, `${sessionId}.jsonl`);
  }

  /**
   * Generate project slug from current working directory
   * 
   * @param cwd - Current working directory
   * @returns Project slug
   */
  static getProjectSlug(cwd: string): string {
    // Convert path to slug by replacing slashes with hyphens
    // Remove leading slash and replace remaining slashes
    return cwd.replace(/^\//, '').replace(/\//g, '-');
  }

  /**
   * Convert transcript message to SDK message format
   * 
   * @param message - Raw transcript message
   * @param markAsReplay - Whether to mark the message as a replay
   * @returns SDK message or null if conversion not supported
   */
  private static convertToSDKMessage(
    message: AnyTranscriptMessage,
    markAsReplay: boolean
  ): SDKMessage | null {
    const isReplay = markAsReplay ? true : undefined;

    switch (message.type) {
      case 'user':
        return {
          type: 'user',
          content: (message as TranscriptUserMessage).content,
          timestamp: message.timestamp || new Date().toISOString(),
          isReplay,
        } as SDKUserMessage;

      case 'assistant':
        const assistantMsg = message as TranscriptAssistantMessage;
        return {
          type: 'assistant',
          content: assistantMsg.content,
          timestamp: message.timestamp || new Date().toISOString(),
          model: assistantMsg.model,
          isReplay,
        } as SDKAssistantMessage;

      case 'system':
        return {
          type: 'system',
          content: (message as TranscriptSystemMessage).content,
          timestamp: message.timestamp || new Date().toISOString(),
          isReplay,
        } as SDKSystemMessage;

      case 'tool_use':
        const toolUseMsg = message as TranscriptToolUseMessage;
        return {
          type: 'tool_use',
          toolName: toolUseMsg.tool_name,
          toolInput: toolUseMsg.tool_input,
          toolUseId: toolUseMsg.tool_use_id,
          timestamp: message.timestamp || new Date().toISOString(),
          isReplay,
        } as SDKToolUseMessage;

      case 'tool_result':
        const toolResultMsg = message as TranscriptToolResultMessage;
        return {
          type: 'tool_result',
          toolUseId: toolResultMsg.tool_use_id,
          content: toolResultMsg.content,
          isError: toolResultMsg.is_error,
          timestamp: message.timestamp || new Date().toISOString(),
          isReplay,
        } as SDKToolResultMessage;

      default:
        // Unknown message type, skip
        return null;
    }
  }

  /**
   * Extract message ID from transcript message (if available)
   * 
   * @param message - Transcript message
   * @returns Message ID or undefined
   */
  private static getMessageId(message: AnyTranscriptMessage): string | undefined {
    // Check common ID fields
    if ('id' in message && typeof message.id === 'string') {
      return message.id;
    }
    if ('message_id' in message && typeof message.message_id === 'string') {
      return message.message_id;
    }
    if ('tool_use_id' in message && typeof message.tool_use_id === 'string') {
      return message.tool_use_id;
    }
    return undefined;
  }

  /**
   * Check if a transcript file exists for a given session
   * 
   * @param sessionId - The session ID
   * @param cwd - Current working directory
   * @returns True if transcript exists
   */
  static transcriptExists(sessionId: string, cwd: string = process.cwd()): boolean {
    const transcriptPath = this.getTranscriptPath(sessionId, cwd);
    return fs.existsSync(transcriptPath);
  }

  /**
   * Get session metadata from transcript file
   * 
   * @param sessionId - The session ID
   * @param cwd - Current working directory
   * @returns Session metadata
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
          const message: AnyTranscriptMessage = JSON.parse(line);
          messageCount++;
          
          if (message.timestamp) {
            if (!firstTimestamp) {
              firstTimestamp = message.timestamp;
            }
            lastTimestamp = message.timestamp;
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
   * Stream messages from a transcript file
   * Generator function that yields messages one at a time
   * 
   * @param transcriptPath - Path to transcript file
   * @param options - Parse options
   */
  static async *streamTranscriptMessages(
    transcriptPath: string,
    options: TranscriptParseOptions = {}
  ): AsyncGenerator<SDKMessage, void, unknown> {
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
          const transcriptMessage: AnyTranscriptMessage = JSON.parse(line);

          if (resumeFromMessageId && !foundResumePoint) {
            if (this.getMessageId(transcriptMessage) === resumeFromMessageId) {
              foundResumePoint = true;
            }
            continue;
          }

          if (!includeFileSnapshots && transcriptMessage.type === 'file_snapshot') {
            continue;
          }

          if (!includeMetaMessages && transcriptMessage.type === 'meta') {
            continue;
          }

          if (filterTypes.length > 0 && !filterTypes.includes(transcriptMessage.type)) {
            continue;
          }

          const sdkMessage = this.convertToSDKMessage(transcriptMessage, markAsReplay);
          
          if (sdkMessage) {
            yield sdkMessage;
          }
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
 * Convenience function to parse a transcript file
 * 
 * @param sessionId - Session ID
 * @param options - Parse options
 * @param cwd - Current working directory
 * @returns Array of SDK messages
 */
export async function parseSessionTranscript(
  sessionId: string,
  options: TranscriptParseOptions = {},
  cwd: string = process.cwd()
): Promise<SDKMessage[]> {
  const transcriptPath = TranscriptParser.getTranscriptPath(sessionId, cwd);
  return TranscriptParser.parseTranscriptFile(transcriptPath, options);
}

/**
 * Convenience function to stream transcript messages
 * 
 * @param sessionId - Session ID
 * @param options - Parse options
 * @param cwd - Current working directory
 */
export async function* streamSessionTranscript(
  sessionId: string,
  options: TranscriptParseOptions = {},
  cwd: string = process.cwd()
): AsyncGenerator<SDKMessage, void, unknown> {
  const transcriptPath = TranscriptParser.getTranscriptPath(sessionId, cwd);
  yield* TranscriptParser.streamTranscriptMessages(transcriptPath, options);
}
