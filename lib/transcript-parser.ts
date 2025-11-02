/**
 * Claude Agent SDK Transcript Parser
 * 
 * A standalone parser for JSONL transcript files produced by the Claude Agent SDK.
 * Useful for syncing sessions to databases, analytics, or other external systems.
 * 
 * @version 1.0.0
 * @license MIT
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import * as os from 'os';

/**
 * A single message from the transcript
 */
export interface TranscriptMessage {
  type: string;
  [key: string]: any;
}

/**
 * Options for parsing transcripts
 */
export interface ParseOptions {
  /**
   * Filter to only include specific message types
   * @example ['user', 'assistant', 'system']
   */
  filterTypes?: string[];
  
  /**
   * Start parsing from a specific message ID
   */
  startFromMessageId?: string;
  
  /**
   * Stop parsing at a specific message ID (inclusive)
   */
  stopAtMessageId?: string;
  
  /**
   * Skip malformed lines instead of throwing errors
   * @default true
   */
  skipMalformed?: boolean;
  
  /**
   * Maximum number of messages to parse
   */
  limit?: number;
}

/**
 * Metadata about a transcript file
 */
export interface TranscriptMetadata {
  filePath: string;
  sessionId: string;
  messageCount: number;
  fileSize: number;
  firstMessageType?: string;
  lastMessageType?: string;
  createdAt?: Date;
  modifiedAt?: Date;
}

/**
 * Result of parsing a transcript
 */
export interface ParseResult {
  messages: TranscriptMessage[];
  metadata: {
    totalLines: number;
    parsedMessages: number;
    skippedLines: number;
    errors: Array<{ line: number; error: string }>;
  };
}

/**
 * Claude Agent SDK Transcript Parser
 * 
 * Parses JSONL transcript files produced by the Claude Agent SDK.
 * Each line in the transcript is a JSON object representing a message.
 */
export class TranscriptParser {
  /**
   * Parse a transcript file and return all messages
   * 
   * @param filePath - Path to the JSONL transcript file
   * @param options - Parsing options
   * @returns Parse result with messages and metadata
   * 
   * @example
   * ```typescript
   * const result = await TranscriptParser.parse('/path/to/session.jsonl');
   * console.log(`Parsed ${result.messages.length} messages`);
   * 
   * result.messages.forEach(msg => {
   *   console.log(msg.type, msg);
   * });
   * ```
   */
  static async parse(
    filePath: string,
    options: ParseOptions = {}
  ): Promise<ParseResult> {
    const {
      filterTypes = [],
      startFromMessageId,
      stopAtMessageId,
      skipMalformed = true,
      limit
    } = options;

    if (!fs.existsSync(filePath)) {
      throw new Error(`Transcript file not found: ${filePath}`);
    }

    const messages: TranscriptMessage[] = [];
    const errors: Array<{ line: number; error: string }> = [];
    
    let totalLines = 0;
    let skippedLines = 0;
    let foundStart = !startFromMessageId;
    let shouldStop = false;

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        totalLines++;

        // Skip empty lines
        if (!line.trim()) {
          skippedLines++;
          continue;
        }

        // Check limit
        if (limit && messages.length >= limit) {
          break;
        }

        try {
          const message: TranscriptMessage = JSON.parse(line);

          // Check if we should start parsing
          if (!foundStart) {
            const msgId = this.getMessageId(message);
            if (msgId === startFromMessageId) {
              foundStart = true;
            } else {
              skippedLines++;
              continue;
            }
          }

          // Filter by type if specified
          if (filterTypes.length > 0 && !filterTypes.includes(message.type)) {
            skippedLines++;
            continue;
          }

          messages.push(message);

          // Check if we should stop
          if (stopAtMessageId) {
            const msgId = this.getMessageId(message);
            if (msgId === stopAtMessageId) {
              shouldStop = true;
              break;
            }
          }

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push({ line: totalLines, error: errorMsg });

          if (!skipMalformed) {
            throw new Error(`Failed to parse line ${totalLines}: ${errorMsg}`);
          }
          skippedLines++;
        }
      }
    } finally {
      fileStream.close();
    }

    return {
      messages,
      metadata: {
        totalLines,
        parsedMessages: messages.length,
        skippedLines,
        errors
      }
    };
  }

  /**
   * Stream parse a transcript file (memory efficient for large files)
   * 
   * @param filePath - Path to the JSONL transcript file
   * @param options - Parsing options
   * @yields Individual messages from the transcript
   * 
   * @example
   * ```typescript
   * for await (const message of TranscriptParser.stream('/path/to/session.jsonl')) {
   *   // Process message immediately without loading all into memory
   *   await saveToDatabase(message);
   * }
   * ```
   */
  static async *stream(
    filePath: string,
    options: ParseOptions = {}
  ): AsyncGenerator<TranscriptMessage, void, unknown> {
    const {
      filterTypes = [],
      startFromMessageId,
      stopAtMessageId,
      skipMalformed = true,
      limit
    } = options;

    if (!fs.existsSync(filePath)) {
      throw new Error(`Transcript file not found: ${filePath}`);
    }

    let foundStart = !startFromMessageId;
    let count = 0;

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;

        if (limit && count >= limit) {
          break;
        }

        try {
          const message: TranscriptMessage = JSON.parse(line);

          if (!foundStart) {
            const msgId = this.getMessageId(message);
            if (msgId === startFromMessageId) {
              foundStart = true;
            } else {
              continue;
            }
          }

          if (filterTypes.length > 0 && !filterTypes.includes(message.type)) {
            continue;
          }

          yield message;
          count++;

          if (stopAtMessageId) {
            const msgId = this.getMessageId(message);
            if (msgId === stopAtMessageId) {
              break;
            }
          }

        } catch (error) {
          if (!skipMalformed) {
            throw error;
          }
          // Skip malformed lines silently when streaming
        }
      }
    } finally {
      fileStream.close();
    }
  }

  /**
   * Get metadata about a transcript file without parsing all messages
   * 
   * @param filePath - Path to the JSONL transcript file
   * @returns Metadata about the transcript
   * 
   * @example
   * ```typescript
   * const meta = await TranscriptParser.getMetadata('/path/to/session.jsonl');
   * console.log(`Session ${meta.sessionId} has ${meta.messageCount} messages`);
   * ```
   */
  static async getMetadata(filePath: string): Promise<TranscriptMetadata> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Transcript file not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const sessionId = path.basename(filePath, '.jsonl');

    let messageCount = 0;
    let firstMessageType: string | undefined;
    let lastMessageType: string | undefined;

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const message: TranscriptMessage = JSON.parse(line);
          messageCount++;

          if (!firstMessageType) {
            firstMessageType = message.type;
          }
          lastMessageType = message.type;
        } catch {
          // Skip malformed lines when counting
        }
      }
    } finally {
      fileStream.close();
    }

    return {
      filePath,
      sessionId,
      messageCount,
      fileSize: stats.size,
      firstMessageType,
      lastMessageType,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime
    };
  }

  /**
   * Get the transcript path for a session ID
   * 
   * @param sessionId - The session ID
   * @param cwd - Current working directory (defaults to process.cwd())
   * @returns Path to the transcript file
   * 
   * @example
   * ```typescript
   * const path = TranscriptParser.getTranscriptPath('session-123');
   * // Returns: /home/user/.claude/projects/workspace/session-123.jsonl
   * ```
   */
  static getTranscriptPath(sessionId: string, cwd: string = process.cwd()): string {
    const homeDir = os.homedir();
    const projectSlug = this.getProjectSlug(cwd);
    return path.join(homeDir, '.claude', 'projects', projectSlug, `${sessionId}.jsonl`);
  }

  /**
   * Generate project slug from directory path
   * 
   * @param dirPath - Directory path
   * @returns Project slug
   * 
   * @example
   * ```typescript
   * TranscriptParser.getProjectSlug('/home/user/my-project')
   * // Returns: 'home-user-my-project'
   * ```
   */
  static getProjectSlug(dirPath: string): string {
    return dirPath.replace(/^\//, '').replace(/\//g, '-');
  }

  /**
   * Find all transcript files in the Claude projects directory
   * 
   * @returns Array of transcript file paths
   * 
   * @example
   * ```typescript
   * const transcripts = TranscriptParser.findAllTranscripts();
   * for (const path of transcripts) {
   *   const meta = await TranscriptParser.getMetadata(path);
   *   console.log(meta.sessionId, meta.messageCount);
   * }
   * ```
   */
  static findAllTranscripts(): string[] {
    const homeDir = os.homedir();
    const projectsDir = path.join(homeDir, '.claude', 'projects');

    if (!fs.existsSync(projectsDir)) {
      return [];
    }

    const transcripts: string[] = [];

    // Iterate through all project directories
    for (const project of fs.readdirSync(projectsDir)) {
      const projectPath = path.join(projectsDir, project);
      
      if (!fs.statSync(projectPath).isDirectory()) {
        continue;
      }

      // Find all .jsonl files in the project directory
      for (const file of fs.readdirSync(projectPath)) {
        if (file.endsWith('.jsonl')) {
          transcripts.push(path.join(projectPath, file));
        }
      }
    }

    return transcripts;
  }

  /**
   * Extract message ID from a message
   * Tries common ID fields: uuid, id, message_id, tool_use_id
   * 
   * @param message - The message object
   * @returns Message ID or undefined
   */
  private static getMessageId(message: TranscriptMessage): string | undefined {
    if (message.uuid) return message.uuid;
    if (message.id) return message.id;
    if (message.message_id) return message.message_id;
    if (message.tool_use_id) return message.tool_use_id;
    if (message.message?.id) return message.message.id;
    return undefined;
  }
}

/**
 * Convenience function to parse a transcript by session ID
 * 
 * @param sessionId - The session ID
 * @param options - Parsing options
 * @param cwd - Current working directory
 * @returns Parse result
 * 
 * @example
 * ```typescript
 * const result = await parseTranscript('session-123');
 * ```
 */
export async function parseTranscript(
  sessionId: string,
  options?: ParseOptions,
  cwd?: string
): Promise<ParseResult> {
  const filePath = TranscriptParser.getTranscriptPath(sessionId, cwd);
  return TranscriptParser.parse(filePath, options);
}

/**
 * Convenience function to stream a transcript by session ID
 * 
 * @param sessionId - The session ID
 * @param options - Parsing options
 * @param cwd - Current working directory
 * @yields Messages from the transcript
 * 
 * @example
 * ```typescript
 * for await (const message of streamTranscript('session-123')) {
 *   console.log(message);
 * }
 * ```
 */
export async function* streamTranscript(
  sessionId: string,
  options?: ParseOptions,
  cwd?: string
): AsyncGenerator<TranscriptMessage, void, unknown> {
  const filePath = TranscriptParser.getTranscriptPath(sessionId, cwd);
  yield* TranscriptParser.stream(filePath, options);
}

// Default export
export default TranscriptParser;
