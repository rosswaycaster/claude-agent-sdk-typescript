# Claude Agent SDK Transcript Parser

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)

## Overview

A standalone TypeScript parser for JSONL transcript files produced by the Claude Agent SDK. Perfect for syncing sessions to databases, analytics, or other external systems.

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { TranscriptParser } from './lib/transcript-parser';

// Parse a transcript file
const result = await TranscriptParser.parse('/path/to/session.jsonl');
console.log(`Parsed ${result.messages.length} messages`);

result.messages.forEach(msg => {
  console.log(msg.type, msg);
});
```

## API Reference

### `TranscriptParser.parse(filePath, options?)`

Parse a complete transcript file into memory.

**Parameters:**
- `filePath` (string): Path to the JSONL transcript file
- `options` (optional):
  - `filterTypes` (string[]): Only include specific message types
  - `startFromMessageId` (string): Start parsing from a specific message
  - `stopAtMessageId` (string): Stop at a specific message (inclusive)
  - `skipMalformed` (boolean): Skip invalid JSON lines (default: true)
  - `limit` (number): Maximum messages to parse

**Returns:** `ParseResult` with:
- `messages` (TranscriptMessage[]): Array of parsed messages
- `metadata`:
  - `totalLines`: Total lines in file
  - `parsedMessages`: Number of successfully parsed messages
  - `skippedLines`: Number of skipped lines
  - `errors`: Array of parsing errors with line numbers

**Example:**

```typescript
// Basic usage
const result = await TranscriptParser.parse('session.jsonl');

// Filter to conversation only
const result = await TranscriptParser.parse('session.jsonl', {
  filterTypes: ['user', 'assistant']
});

// Parse a specific range
const result = await TranscriptParser.parse('session.jsonl', {
  startFromMessageId: 'msg-123',
  stopAtMessageId: 'msg-456'
});

// Limit number of messages
const result = await TranscriptParser.parse('session.jsonl', {
  limit: 100
});
```

### `TranscriptParser.stream(filePath, options?)`

Stream parse a transcript file (memory efficient for large files).

**Parameters:** Same as `parse()`

**Returns:** `AsyncGenerator<TranscriptMessage>`

**Example:**

```typescript
// Stream all messages
for await (const message of TranscriptParser.stream('session.jsonl')) {
  await saveToDatabase(message);
}

// Stream with filters
for await (const message of TranscriptParser.stream('session.jsonl', {
  filterTypes: ['user', 'assistant'],
  limit: 50
})) {
  console.log(message);
}
```

### `TranscriptParser.getMetadata(filePath)`

Get metadata about a transcript without parsing all messages.

**Returns:** `TranscriptMetadata` with:
- `filePath`: Full path to the file
- `sessionId`: Session ID (filename without extension)
- `messageCount`: Total number of messages
- `fileSize`: File size in bytes
- `firstMessageType`: Type of first message
- `lastMessageType`: Type of last message
- `createdAt`: File creation date
- `modifiedAt`: File modification date

**Example:**

```typescript
const meta = await TranscriptParser.getMetadata('session.jsonl');
console.log(`Session ${meta.sessionId}:`);
console.log(`  Messages: ${meta.messageCount}`);
console.log(`  Size: ${(meta.fileSize / 1024).toFixed(2)} KB`);
console.log(`  Modified: ${meta.modifiedAt.toLocaleString()}`);
```

### `TranscriptParser.getTranscriptPath(sessionId, cwd?)`

Get the file path for a session ID.

**Parameters:**
- `sessionId` (string): The session ID
- `cwd` (string, optional): Current working directory (default: `process.cwd()`)

**Returns:** Absolute path to the transcript file

**Example:**

```typescript
const path = TranscriptParser.getTranscriptPath('abc-123');
// /home/user/.claude/projects/workspace/abc-123.jsonl

const path = TranscriptParser.getTranscriptPath('abc-123', '/home/user/my-project');
// /home/user/.claude/projects/home-user-my-project/abc-123.jsonl
```

### `TranscriptParser.getProjectSlug(dirPath)`

Convert a directory path to a project slug.

**Example:**

```typescript
TranscriptParser.getProjectSlug('/home/user/my-project');
// Returns: 'home-user-my-project'

TranscriptParser.getProjectSlug('/workspace');
// Returns: 'workspace'
```

### `TranscriptParser.findAllTranscripts()`

Find all transcript files in `~/.claude/projects/`.

**Returns:** Array of transcript file paths

**Example:**

```typescript
const transcripts = TranscriptParser.findAllTranscripts();
console.log(`Found ${transcripts.length} sessions`);

for (const path of transcripts) {
  const meta = await TranscriptParser.getMetadata(path);
  console.log(`${meta.sessionId}: ${meta.messageCount} messages`);
}
```

### Convenience Functions

#### `parseTranscript(sessionId, options?, cwd?)`

Parse a transcript by session ID instead of file path.

```typescript
const result = await parseTranscript('session-123', {
  filterTypes: ['user', 'assistant']
});
```

#### `streamTranscript(sessionId, options?, cwd?)`

Stream a transcript by session ID.

```typescript
for await (const message of streamTranscript('session-123')) {
  console.log(message);
}
```

## Usage Examples

### Sync to Database

```typescript
import { TranscriptParser } from './lib/transcript-parser';

async function syncToDatabase(sessionId: string) {
  // Stream parse for memory efficiency
  for await (const message of streamTranscript(sessionId)) {
    await db.messages.upsert({
      where: { uuid: message.uuid },
      create: {
        sessionId: message.session_id,
        type: message.type,
        data: message
      },
      update: {
        data: message
      }
    });
  }
}
```

### Generate Analytics

```typescript
async function analyzeSession(filePath: string) {
  const result = await TranscriptParser.parse(filePath);
  
  const stats = {
    total: result.messages.length,
    byType: {} as Record<string, number>,
    errors: result.metadata.errors.length
  };
  
  for (const msg of result.messages) {
    stats.byType[msg.type] = (stats.byType[msg.type] || 0) + 1;
  }
  
  return stats;
}

const stats = await analyzeSession('session.jsonl');
console.log('Message types:', stats.byType);
```

### Export to Different Format

```typescript
async function exportToCSV(sessionId: string, outputPath: string) {
  const result = await parseTranscript(sessionId, {
    filterTypes: ['user', 'assistant']
  });
  
  const rows = result.messages.map(msg => ({
    type: msg.type,
    timestamp: msg.timestamp || '',
    content: JSON.stringify(msg.message?.content || '')
  }));
  
  // Write to CSV...
}
```

### Monitor All Sessions

```typescript
async function monitorSessions() {
  const transcripts = TranscriptParser.findAllTranscripts();
  
  for (const path of transcripts) {
    const meta = await TranscriptParser.getMetadata(path);
    
    // Check if recently modified (within last hour)
    const hourAgo = Date.now() - 3600000;
    if (meta.modifiedAt.getTime() > hourAgo) {
      console.log(`Active session: ${meta.sessionId}`);
      
      // Parse and process...
      const result = await TranscriptParser.parse(path);
      await processSession(result);
    }
  }
}
```

### Filter and Search

```typescript
async function searchMessages(sessionId: string, searchTerm: string) {
  const matches: TranscriptMessage[] = [];
  
  for await (const message of streamTranscript(sessionId)) {
    const content = JSON.stringify(message).toLowerCase();
    if (content.includes(searchTerm.toLowerCase())) {
      matches.push(message);
    }
  }
  
  return matches;
}

const results = await searchMessages('session-123', 'error');
console.log(`Found ${results.length} messages containing 'error'`);
```

## Transcript File Format

Transcript files are stored in JSONL (JSON Lines) format at:
```
~/.claude/projects/{project-slug}/{session-id}.jsonl
```

Each line is a complete JSON object representing a message:

```jsonl
{"type":"system","subtype":"init","session_id":"abc","uuid":"123","model":"claude-sonnet-4.5"}
{"type":"user","message":{"content":"Hello"},"session_id":"abc","uuid":"456"}
{"type":"assistant","message":{"content":[{"type":"text","text":"Hi!"}]},"session_id":"abc","uuid":"789"}
```

### Common Message Types

- **system**: System messages (init, compaction, etc.)
- **user**: User messages
- **assistant**: Assistant responses
- **result**: Session results (success/error)
- **stream_event**: Streaming events
- **tool_progress**: Tool execution progress
- **auth_status**: Authentication status

### Message Structure

Messages generally have these fields:

- `type`: Message type (required)
- `session_id`: Session ID
- `uuid`: Unique message ID
- `message`: Message content (for user/assistant)
- `timestamp`: ISO timestamp
- Type-specific fields

## Error Handling

```typescript
try {
  const result = await TranscriptParser.parse('session.jsonl');
  
  // Check for parsing errors
  if (result.metadata.errors.length > 0) {
    console.warn(`${result.metadata.errors.length} lines failed to parse`);
    result.metadata.errors.forEach(err => {
      console.warn(`Line ${err.line}: ${err.error}`);
    });
  }
  
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('Transcript file does not exist');
  } else {
    console.error('Parse error:', error);
  }
}
```

## Performance Tips

1. **Use streaming for large files:**
   ```typescript
   // Good for large sessions
   for await (const msg of TranscriptParser.stream('large.jsonl')) {
     await process(msg);
   }
   
   // Loads entire file into memory
   const result = await TranscriptParser.parse('large.jsonl');
   ```

2. **Filter early:**
   ```typescript
   // Filter at parse time (efficient)
   const result = await TranscriptParser.parse('session.jsonl', {
     filterTypes: ['user', 'assistant']
   });
   
   // Filter after parsing (less efficient)
   const result = await TranscriptParser.parse('session.jsonl');
   const filtered = result.messages.filter(m => m.type === 'user');
   ```

3. **Use limits for sampling:**
   ```typescript
   // Get first 100 messages quickly
   const result = await TranscriptParser.parse('session.jsonl', {
     limit: 100
   });
   ```

## TypeScript Types

```typescript
interface TranscriptMessage {
  type: string;
  [key: string]: any;
}

interface ParseOptions {
  filterTypes?: string[];
  startFromMessageId?: string;
  stopAtMessageId?: string;
  skipMalformed?: boolean;
  limit?: number;
}

interface ParseResult {
  messages: TranscriptMessage[];
  metadata: {
    totalLines: number;
    parsedMessages: number;
    skippedLines: number;
    errors: Array<{ line: number; error: string }>;
  };
}

interface TranscriptMetadata {
  filePath: string;
  sessionId: string;
  messageCount: number;
  fileSize: number;
  firstMessageType?: string;
  lastMessageType?: string;
  createdAt?: Date;
  modifiedAt?: Date;
}
```

## Testing

Run the test suite:

```bash
npm test
```

## License

MIT
