# Implementation Notes

## Session History Retrieval Feature

This document outlines the implementation of the session history retrieval feature for the Claude Agent SDK TypeScript package.

### Overview

The feature allows users to programmatically retrieve historical messages when resuming Claude Code sessions. Previously, users could only access new messages generated after resumption - now they can access the full conversation history.

### Implementation Approach

Based on the GitHub issue #14 and the Python SDK's approach, I've implemented an **internal transcript parser utility** similar to Python's `_internal/message_parser.py`.

### Architecture

```
src/
??? _internal/
?   ??? index.ts                 # Internal module exports
?   ??? types.ts                 # Internal types for transcript parsing
?   ??? transcript-parser.ts     # Core transcript parsing logic
??? session-history.ts           # Public API for session history
??? index.ts                     # Main module exports
??? __tests__/
    ??? transcript-parser.test.ts
    ??? session-history.test.ts
```

### Key Components

#### 1. Transcript Parser (`src/_internal/transcript-parser.ts`)

The core utility that reads and parses JSONL transcript files. Key features:

- **File Location**: Automatically determines transcript location from session ID
  - Path: `~/.claude/projects/{project-slug}/{session-id}.jsonl`
  - Project slug is derived from CWD: `/home/user/project` ? `home-user-project`

- **Parsing Methods**:
  - `parseTranscriptFile()`: Load entire transcript into memory
  - `streamTranscriptMessages()`: Memory-efficient streaming for large sessions
  - `getSessionMetadata()`: Get session info without loading all messages

- **Filtering Options**:
  - Filter by message type
  - Exclude file snapshots (default)
  - Exclude meta messages (default)
  - Resume from specific message ID

#### 2. Public API (`src/session-history.ts`)

User-facing functions that wrap the internal parser:

- `getSessionHistory()`: Retrieve full conversation history
- `streamSessionHistory()`: Stream messages for large sessions
- `getSessionInfo()`: Get session metadata
- `sessionExists()`: Check if session transcript exists
- `getSessionTranscriptPath()`: Get file system path to transcript

All functions automatically mark messages with `isReplay: true` to indicate they're historical.

#### 3. Types (`src/_internal/types.ts`)

Minimal types for transcript parsing options. The actual SDK message types are imported from the main SDK package to ensure compatibility.

### Design Decisions

1. **No Duplication of Types**: Rather than define our own SDK message types, we import them from `@anthropic-ai/claude-agent-sdk` as a peer dependency. This ensures compatibility and reduces maintenance.

2. **JSONL Format**: Transcript files contain complete SDK messages in JSONL format, one message per line. This means we can return messages in their original format without transformation.

3. **Replay Marking**: User messages are automatically marked with `isReplay: true` when retrieved from history, matching the existing `SDKUserMessageReplay` type in the SDK.

4. **Filtering Defaults**: File snapshots and meta messages are excluded by default to reduce noise, but can be included via options.

5. **Project Slug Derivation**: The project slug is calculated by removing the leading slash and replacing remaining slashes with hyphens. This matches the Claude Code CLI behavior.

### Usage Example

```typescript
import { query, getSessionHistory } from '@anthropic-ai/claude-agent-sdk';

// Start a session
const session = query({ prompt: "Help me", options: {} });
let sessionId;
for await (const message of session) {
  sessionId = message.session_id;
}

// Retrieve history
const history = await getSessionHistory(sessionId);

// Filter to conversation only
const conversation = await getSessionHistory(sessionId, {
  filterTypes: ['user', 'assistant']
});

// Stream large sessions
for await (const message of streamSessionHistory(sessionId)) {
  console.log(message.type, message);
}
```

### Testing

Comprehensive test suites cover:

- Project slug generation from various paths
- Transcript path construction
- JSONL parsing (including malformed lines)
- Message filtering
- Resume from specific message ID
- Streaming vs batch loading
- Session metadata extraction
- Error handling

### Integration with Existing SDK

The implementation is designed as an **additive feature** that:

- Doesn't modify the existing `query()` function
- Uses existing SDK message types
- Works with the current session/transcript format
- Maintains backward compatibility

### Alternative Considered: `includeHistory` Option

The GitHub issue proposed adding an `includeHistory` option to the `query()` function to replay messages during resumption. This approach was **not implemented** because:

1. The standalone functions provide more flexibility
2. Users can choose when to load history
3. Memory usage is more controllable
4. Easier to filter and process historical messages separately
5. The API is simpler and more explicit

If this option is desired in the future, it can be added as:

```typescript
const session = query({
  prompt: "",
  options: {
    resume: sessionId,
    includeHistory: true  // Replay historical messages first
  }
});
```

This would internally use the transcript parser to yield historical messages before streaming new ones.

### File Format

Transcript files (`.jsonl`) contain JSON-serialized SDK messages:

```jsonl
{"type":"system","subtype":"init","session_id":"...","uuid":"...","model":"..."}
{"type":"user","message":{"content":"Hello"},"session_id":"...","uuid":"..."}
{"type":"assistant","message":{"content":[{"type":"text","text":"Hi!"}]},"session_id":"..."}
{"type":"result","subtype":"success","duration_ms":5000,"num_turns":1,"session_id":"..."}
```

### Future Enhancements

Potential future improvements:

1. **Caching**: Cache parsed transcripts for repeated access
2. **Compression**: Support for compressed transcript files
3. **Search**: Built-in search functionality across sessions
4. **Diff**: Compare two sessions or versions
5. **Merge**: Combine multiple session transcripts
6. **Analytics**: Built-in analytics and reporting
7. **Export**: Additional export formats (JSON, CSV, HTML)

### Dependencies

- **Runtime**: Only Node.js built-ins (`fs`, `readline`, `path`, `os`)
- **Peer**: `@anthropic-ai/claude-agent-sdk` ^0.1.30 for types
- **Dev**: TypeScript, Jest for testing

### Breaking Changes

None - this is a purely additive feature.

### Documentation

- **README.md**: Updated with feature overview
- **docs/SESSION_HISTORY.md**: Complete API reference and usage guide
- **examples/**: Four example scripts demonstrating common use cases
  - `basic-history.ts`: Simple history retrieval
  - `resume-with-context.ts`: Resume session with context display
  - `export-markdown.ts`: Export session to Markdown
  - `session-analytics.ts`: Analyze session metrics

### References

- GitHub Issue: anthropics/claude-agent-sdk-typescript#14
- Python SDK: `claude-agent-sdk-python/_internal/message_parser.py`
- TypeScript SDK: `@anthropic-ai/claude-agent-sdk` v0.1.30
