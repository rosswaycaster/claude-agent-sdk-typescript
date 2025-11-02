# Session History Retrieval

This module provides APIs for retrieving historical messages when resuming Claude Code sessions. When you resume a session using `query({ options: { resume: sessionId } })`, you can now programmatically access the full conversation history.

## Installation

This functionality is available as part of the Claude Agent SDK:

```bash
npm install @anthropic-ai/claude-agent-sdk
```

## Quick Start

### Basic Usage

```typescript
import { query, getSessionHistory } from '@anthropic-ai/claude-agent-sdk';

// Start a session
const session = query({
  prompt: "Help me with my project",
  options: {}
});

let sessionId;
for await (const message of session) {
  if (message.session_id) {
    sessionId = message.session_id;
  }
  console.log(message.type, message);
}

// Later, retrieve the full history
const history = await getSessionHistory(sessionId);
console.log(`Session has ${history.length} messages`);

history.forEach(message => {
  if (message.type === 'user' && message.isReplay) {
    console.log('User:', message.message.content);
  } else if (message.type === 'assistant') {
    console.log('Assistant:', message.message.content);
  }
});
```

## API Reference

### `getSessionHistory(sessionId, options?)`

Retrieves the complete message history from a session.

**Parameters:**
- `sessionId` (string): The session ID from `SDKMessage.session_id`
- `options` (optional object):
  - `cwd` (string): Current working directory (defaults to `process.cwd()`)
  - `filterTypes` (string[]): Filter messages by type (e.g., `['user', 'assistant']`)
  - `resumeFromMessageId` (string): Resume from a specific message ID
  - `includeFileSnapshots` (boolean): Include file snapshot messages (default: false)
  - `includeMetaMessages` (boolean): Include meta messages (default: false)

**Returns:** `Promise<SDKMessage[]>` - Array of SDK messages

**Example:**

```typescript
import { getSessionHistory } from '@anthropic-ai/claude-agent-sdk';

// Get all messages
const history = await getSessionHistory('34e94925-f4cc-4685-8869-83c77062ad14');

// Get only conversation messages
const conversation = await getSessionHistory(sessionId, {
  filterTypes: ['user', 'assistant']
});

// Resume from a specific point
const recentHistory = await getSessionHistory(sessionId, {
  resumeFromMessageId: 'msg_abc123'
});
```

### `streamSessionHistory(sessionId, options?)`

Streams historical messages one at a time (memory-efficient for large sessions).

**Parameters:** Same as `getSessionHistory`

**Returns:** `AsyncGenerator<SDKMessage>` - Async generator yielding messages

**Example:**

```typescript
import { streamSessionHistory } from '@anthropic-ai/claude-agent-sdk';

for await (const message of streamSessionHistory('session-id')) {
  if (message.type === 'user' && message.isReplay) {
    console.log('Historical user message:', message.message.content);
  } else if (message.type === 'assistant') {
    console.log('Assistant response:', message.message.content);
  }
}
```

### `getSessionInfo(sessionId, cwd?)`

Gets metadata about a session without loading all messages.

**Parameters:**
- `sessionId` (string): The session ID
- `cwd` (string, optional): Current working directory

**Returns:** `Promise<object>` with:
- `sessionId` (string): The session ID
- `messageCount` (number): Total number of messages
- `firstTimestamp` (string): Timestamp of first message
- `lastTimestamp` (string): Timestamp of last message
- `transcriptPath` (string): Path to the transcript file

**Example:**

```typescript
import { getSessionInfo } from '@anthropic-ai/claude-agent-sdk';

const info = await getSessionInfo('session-id');
console.log(`Session has ${info.messageCount} messages`);
console.log(`Started: ${new Date(info.firstTimestamp).toLocaleString()}`);
console.log(`Duration: ${new Date(info.lastTimestamp) - new Date(info.firstTimestamp)}ms`);
```

### `sessionExists(sessionId, cwd?)`

Checks if a session's transcript exists on disk.

**Parameters:**
- `sessionId` (string): The session ID
- `cwd` (string, optional): Current working directory

**Returns:** `boolean` - True if the session transcript exists

**Example:**

```typescript
import { sessionExists, getSessionHistory } from '@anthropic-ai/claude-agent-sdk';

if (sessionExists('session-id')) {
  const history = await getSessionHistory('session-id');
  console.log('Session found:', history.length, 'messages');
} else {
  console.log('Session not found');
}
```

### `getSessionTranscriptPath(sessionId, cwd?)`

Gets the file system path to a session's transcript.

**Parameters:**
- `sessionId` (string): The session ID
- `cwd` (string, optional): Current working directory

**Returns:** `string` - Absolute path to the transcript file

**Example:**

```typescript
import { getSessionTranscriptPath } from '@anthropic-ai/claude-agent-sdk';

const path = getSessionTranscriptPath('session-id');
console.log('Transcript location:', path);
// Output: /home/user/.claude/projects/workspace/session-id.jsonl
```

## Use Cases

### 1. Session Management Dashboard

Build a dashboard to view and manage all your Claude Code sessions:

```typescript
import { readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getSessionInfo, getSessionHistory } from '@anthropic-ai/claude-agent-sdk';

async function listAllSessions() {
  const projectsDir = join(homedir(), '.claude', 'projects');
  const sessions = [];

  // Iterate through all projects
  for (const project of readdirSync(projectsDir)) {
    const projectPath = join(projectsDir, project);
    const transcripts = readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));

    for (const transcript of transcripts) {
      const sessionId = transcript.replace('.jsonl', '');
      const info = await getSessionInfo(sessionId, '/' + project.replace(/-/g, '/'));
      sessions.push({
        sessionId,
        project,
        ...info
      });
    }
  }

  return sessions;
}

// Display sessions
const sessions = await listAllSessions();
sessions.forEach(s => {
  console.log(`${s.sessionId}: ${s.messageCount} messages (${s.project})`);
});
```

### 2. Conversation Exporter

Export sessions to different formats:

```typescript
import { getSessionHistory } from '@anthropic-ai/claude-agent-sdk';
import { writeFileSync } from 'fs';

async function exportToMarkdown(sessionId, outputPath) {
  const history = await getSessionHistory(sessionId, {
    filterTypes: ['user', 'assistant', 'system']
  });

  let markdown = `# Claude Code Session ${sessionId}\n\n`;

  for (const message of history) {
    if (message.type === 'system') {
      markdown += `## Session Started\n\n`;
      markdown += `- Model: ${message.model}\n`;
      markdown += `- CWD: ${message.cwd}\n`;
      markdown += `- Tools: ${message.tools.join(', ')}\n\n`;
    } else if (message.type === 'user') {
      markdown += `### User\n\n${message.message.content}\n\n`;
    } else if (message.type === 'assistant') {
      const text = message.message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n\n');
      markdown += `### Assistant\n\n${text}\n\n`;
    }
  }

  writeFileSync(outputPath, markdown);
}

await exportToMarkdown('session-id', 'session-export.md');
```

### 3. Session Analytics

Analyze session patterns and usage:

```typescript
import { getSessionHistory } from '@anthropic-ai/claude-agent-sdk';

async function analyzeSession(sessionId) {
  const history = await getSessionHistory(sessionId);

  const stats = {
    totalMessages: history.length,
    userMessages: 0,
    assistantMessages: 0,
    toolUses: 0,
    errors: 0,
    duration: 0,
    totalCost: 0
  };

  for (const message of history) {
    if (message.type === 'user') stats.userMessages++;
    if (message.type === 'assistant') stats.assistantMessages++;
    if (message.type === 'tool_progress') stats.toolUses++;
    if (message.type === 'result') {
      if (message.is_error) stats.errors++;
      stats.duration = message.duration_ms;
      stats.totalCost = message.total_cost_usd;
    }
  }

  return stats;
}

const stats = await analyzeSession('session-id');
console.log('Session Statistics:');
console.log(`- Total Messages: ${stats.totalMessages}`);
console.log(`- User/Assistant Turns: ${stats.userMessages}/${stats.assistantMessages}`);
console.log(`- Tool Uses: ${stats.toolUses}`);
console.log(`- Duration: ${stats.duration}ms`);
console.log(`- Cost: $${stats.totalCost.toFixed(4)}`);
```

### 4. Resume with Context

Resume a session and show the user what happened before:

```typescript
import { query, getSessionHistory } from '@anthropic-ai/claude-agent-sdk';

async function resumeWithContext(sessionId, newPrompt) {
  // Get recent history
  const history = await getSessionHistory(sessionId, {
    filterTypes: ['user', 'assistant']
  });

  // Show context to user
  console.log('\n=== Previous Conversation ===');
  const recent = history.slice(-4); // Last 2 turns
  for (const message of recent) {
    if (message.type === 'user') {
      console.log(`You: ${message.message.content}`);
    } else if (message.type === 'assistant') {
      const text = message.message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join(' ');
      console.log(`Claude: ${text}`);
    }
  }
  console.log('=============================\n');

  // Resume session
  const session = query({
    prompt: newPrompt,
    options: {
      resume: sessionId
    }
  });

  for await (const message of session) {
    // Handle new messages
    console.log(message.type, message);
  }
}

await resumeWithContext('session-id', 'Continue with the next step');
```

### 5. Session Search

Search through historical sessions:

```typescript
import { getSessionHistory } from '@anthropic-ai/claude-agent-sdk';

async function searchSessions(sessionIds, searchTerm) {
  const results = [];

  for (const sessionId of sessionIds) {
    const history = await getSessionHistory(sessionId, {
      filterTypes: ['user', 'assistant']
    });

    const matches = history.filter(message => {
      if (message.type === 'user') {
        return message.message.content.toLowerCase().includes(searchTerm.toLowerCase());
      } else if (message.type === 'assistant') {
        return message.message.content.some(block =>
          block.type === 'text' && block.text.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      return false;
    });

    if (matches.length > 0) {
      results.push({ sessionId, matches });
    }
  }

  return results;
}

const results = await searchSessions(['session-1', 'session-2'], 'react component');
console.log(`Found ${results.length} sessions mentioning 'react component'`);
```

## Message Types

All messages returned have an `isReplay` field set to `true` to indicate they are historical messages:

```typescript
const history = await getSessionHistory('session-id');

history.forEach(message => {
  // Check if this is a replay message
  if (message.type === 'user' && message.isReplay) {
    console.log('This is a historical user message');
  }
});
```

## Transcript File Format

The transcript files are stored in JSONL format (JSON Lines) at:
```
~/.claude/projects/{project-slug}/{session-id}.jsonl
```

Each line is a complete SDK message in JSON format. The messages are stored in chronological order.

## Performance Considerations

- **Memory**: For large sessions, use `streamSessionHistory()` instead of `getSessionHistory()` to avoid loading all messages into memory
- **Filtering**: Apply filters early to reduce the amount of data processed
- **Caching**: Consider caching session info if you need to query it multiple times

## Error Handling

```typescript
import { getSessionHistory, sessionExists } from '@anthropic-ai/claude-agent-sdk';

try {
  // Check if session exists first
  if (!sessionExists(sessionId)) {
    console.error('Session not found');
    return;
  }

  const history = await getSessionHistory(sessionId);
  // Process history...
} catch (error) {
  console.error('Failed to load session history:', error.message);
}
```

## TypeScript Types

All message types are fully typed and match the SDK's message types:

```typescript
import type { 
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKSystemMessage,
  SDKResultMessage
} from '@anthropic-ai/claude-agent-sdk';

const history: SDKMessage[] = await getSessionHistory('session-id');

// Type narrowing works as expected
history.forEach(message => {
  if (message.type === 'user') {
    // message is SDKUserMessage
    console.log(message.message.content);
  } else if (message.type === 'assistant') {
    // message is SDKAssistantMessage
    console.log(message.message.model);
  }
});
```

## Limitations

- Session transcripts are only available after a session has started
- Transcripts are stored locally in `~/.claude/projects/`
- The project slug is derived from the current working directory
- File snapshots and meta messages are excluded by default

## See Also

- [Claude Agent SDK Documentation](https://docs.claude.com/en/api/agent-sdk/overview)
- [Session Management Guide](https://docs.claude.com/en/docs/claude-code/sdk/)
- [API Reference](https://docs.claude.com/en/api/agent-sdk/reference)
