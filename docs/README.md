# Claude Transcript Parser

A standalone TypeScript parser for JSONL transcript files produced by the Claude Agent SDK.

## Quick Links

- [README.md](../README.md) - Full documentation and API reference
- [Example: Sync to Database](./example-sync-database.ts) - Sync all sessions to a database
- [Example: Analytics](./example-analytics.ts) - Generate session analytics
- [Example: Monitor](./example-monitor.ts) - Monitor active sessions

## Project Structure

```
.
??? lib/
?   ??? transcript-parser.ts    # Main parser implementation
??? tests/
?   ??? transcript-parser.test.ts  # Comprehensive test suite
??? docs/
?   ??? example-sync-database.ts   # Database sync example
?   ??? example-analytics.ts       # Analytics example
?   ??? example-monitor.ts         # Monitoring example
??? package.json
??? tsconfig.json
??? jest.config.js
??? README.md
```

## Development

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

Output will be in `dist/` directory.

### Run Tests

```bash
# Run all tests
npm test

# Watch mode
npm test:watch

# With coverage
npm test:coverage
```

### Lint

```bash
npm run lint
```

## Usage

### Import in Your Project

```typescript
import { TranscriptParser } from './lib/transcript-parser';

// or after building
import { TranscriptParser } from './dist/transcript-parser.js';
```

### Basic Example

```typescript
import { TranscriptParser } from './lib/transcript-parser';

// Parse a file
const result = await TranscriptParser.parse('~/.claude/projects/workspace/session.jsonl');
console.log(`Found ${result.messages.length} messages`);

// Stream for large files
for await (const message of TranscriptParser.stream('session.jsonl')) {
  console.log(message.type, message);
}

// Get metadata
const meta = await TranscriptParser.getMetadata('session.jsonl');
console.log(`Session has ${meta.messageCount} messages`);
```

## Running Examples

### Database Sync

```bash
npx ts-node docs/example-sync-database.ts
```

### Analytics

```bash
npx ts-node docs/example-analytics.ts ~/.claude/projects/workspace/session-123.jsonl
```

### Monitor Active Sessions

```bash
# Monitor sessions modified in last 60 minutes
npx ts-node docs/example-monitor.ts

# Monitor sessions modified in last 30 minutes
npx ts-node docs/example-monitor.ts 30
```

## Transcript File Format

JSONL files located at `~/.claude/projects/{project-slug}/{session-id}.jsonl`

Each line is a JSON message:

```jsonl
{"type":"system","subtype":"init","session_id":"abc","uuid":"123"}
{"type":"user","message":{"content":"Hello"},"session_id":"abc","uuid":"456"}
{"type":"assistant","message":{"content":[{"type":"text","text":"Hi!"}]},"uuid":"789"}
```

## Common Message Types

- `system` - System messages (init, compact_boundary, hook_response)
- `user` - User messages
- `assistant` - Assistant responses
- `result` - Session results
- `stream_event` - Streaming events
- `tool_progress` - Tool execution progress
- `auth_status` - Authentication status

## License

MIT
