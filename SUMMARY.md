# Project Summary

A standalone TypeScript parser for JSONL transcript files produced by the Claude Agent SDK.

## ?? What's Included

### Core Library
- **`lib/transcript-parser.ts`** - Complete standalone parser implementation
  - Parse entire transcript files
  - Stream parse for memory efficiency
  - Get metadata without full parse
  - Find all transcripts on system
  - Filter by message type, range, or limit

### Tests
- **`tests/transcript-parser.test.ts`** - Comprehensive test suite
  - All parsing scenarios covered
  - Edge cases and error handling
  - Streaming and filtering tests
  - Metadata extraction tests

### Documentation
- **`README.md`** - Complete API reference and usage guide
- **`docs/README.md`** - Development guide
- **`docs/example-sync-database.ts`** - Database sync example
- **`docs/example-analytics.ts`** - Session analytics example
- **`docs/example-monitor.ts`** - Active session monitoring

### Configuration
- **`package.json`** - Project dependencies and scripts
- **`tsconfig.json`** - TypeScript configuration
- **`jest.config.js`** - Test configuration

## ?? Quick Start

```typescript
import { TranscriptParser } from './lib/transcript-parser';

// Parse a transcript
const result = await TranscriptParser.parse('session.jsonl');
console.log(`Parsed ${result.messages.length} messages`);

// Stream for large files
for await (const msg of TranscriptParser.stream('session.jsonl')) {
  await saveToDatabase(msg);
}

// Get metadata only
const meta = await TranscriptParser.getMetadata('session.jsonl');
console.log(`${meta.sessionId}: ${meta.messageCount} messages`);
```

## ?? Features

? **Full Parsing** - Load entire transcript into memory  
? **Stream Parsing** - Memory-efficient for large files  
? **Filtering** - By type, range, or limit  
? **Metadata** - Quick info without full parse  
? **Auto-discovery** - Find all transcripts on system  
? **Error Handling** - Skip malformed lines gracefully  
? **TypeScript** - Full type safety  
? **Well Tested** - Comprehensive test coverage  
? **Zero Dependencies** - Only Node.js built-ins  

## ?? Use Cases

- **Database Sync** - Sync sessions to PostgreSQL, MongoDB, etc.
- **Analytics** - Generate insights from session data
- **Search** - Build search indices for conversations
- **Export** - Convert to different formats (CSV, Markdown, etc.)
- **Monitoring** - Track active sessions in real-time
- **Backup** - Archive and restore session data

## ?? File Format

Transcripts are stored as JSONL (JSON Lines):

```
~/.claude/projects/{project-slug}/{session-id}.jsonl
```

Each line is a complete SDK message in JSON format.

## ??? Development

```bash
# Install
npm install

# Build
npm run build

# Test
npm test
npm run test:watch
npm run test:coverage

# Lint
npm run lint
```

## ?? API Overview

### Main Methods

- `TranscriptParser.parse(filePath, options?)` - Parse entire file
- `TranscriptParser.stream(filePath, options?)` - Stream parse
- `TranscriptParser.getMetadata(filePath)` - Get file metadata
- `TranscriptParser.findAllTranscripts()` - Find all transcripts
- `TranscriptParser.getTranscriptPath(sessionId, cwd?)` - Get path for session ID
- `TranscriptParser.getProjectSlug(dirPath)` - Convert path to slug

### Convenience Functions

- `parseTranscript(sessionId, options?, cwd?)` - Parse by session ID
- `streamTranscript(sessionId, options?, cwd?)` - Stream by session ID

### Types

- `TranscriptMessage` - A single message
- `ParseOptions` - Parsing configuration
- `ParseResult` - Parse result with metadata
- `TranscriptMetadata` - File metadata

## ?? Testing

All major functionality is tested:

- File parsing (valid, invalid, empty)
- Stream parsing
- Filtering (by type, range, limit)
- Metadata extraction
- Error handling
- Path manipulation
- Transcript discovery

Run tests: `npm test`

## ?? License

MIT

---

**Ready to use!** Import the parser and start syncing your Claude Agent SDK sessions to your database or analytics platform.
