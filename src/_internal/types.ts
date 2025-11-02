/**
 * Internal types for transcript parsing.
 * These represent the raw format stored in JSONL transcript files.
 * 
 * The transcript files contain messages in the SDK's internal format,
 * which we parse and return as SDK message types that match the actual SDK.
 */

/**
 * Raw transcript line format - this is what's stored in the JSONL files.
 * Each line in the transcript is a JSON object that we parse into SDK message types.
 */
export type TranscriptLine = Record<string, any>;

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
