/**
 * Tests for Session History Public API
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSessionHistory, streamSessionHistory, getSessionInfo, sessionExists, getSessionTranscriptPath } from '../session-history';
import { TranscriptParser } from '../_internal/transcript-parser';

describe('Session History API', () => {
  const testDir = path.join(os.tmpdir(), 'claude-sdk-test-api-' + Date.now());
  const sessionId = 'api-test-session-123';

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Create a sample transcript for tests
    const transcriptPath = TranscriptParser.getTranscriptPath(sessionId, testDir);
    fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });

    const messages = [
      {
        type: 'system',
        subtype: 'init',
        session_id: sessionId,
        uuid: '00000000-0000-0000-0000-000000000001',
        cwd: testDir,
        tools: ['read_file', 'write_file'],
        model: 'claude-sonnet-4.5',
        permissionMode: 'default',
        claude_code_version: '2.0.0',
        slash_commands: [],
        skills: [],
        plugins: [],
        mcp_servers: [],
        apiKeySource: 'user',
        output_style: 'normal'
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: 'Hello, can you help me?'
        },
        parent_tool_use_id: null,
        session_id: sessionId,
        uuid: '00000000-0000-0000-0000-000000000002',
        timestamp: '2025-01-01T10:00:00Z'
      },
      {
        type: 'assistant',
        message: {
          id: 'msg_abc123',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Of course! I\'d be happy to help you.'
            }
          ],
          model: 'claude-sonnet-4.5',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 100,
            output_tokens: 20
          }
        },
        parent_tool_use_id: null,
        session_id: sessionId,
        uuid: '00000000-0000-0000-0000-000000000003',
        timestamp: '2025-01-01T10:00:01Z'
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: 'What files are in the current directory?'
        },
        parent_tool_use_id: null,
        session_id: sessionId,
        uuid: '00000000-0000-0000-0000-000000000004',
        timestamp: '2025-01-01T10:00:05Z'
      },
      {
        type: 'result',
        subtype: 'success',
        duration_ms: 5000,
        duration_api_ms: 2000,
        is_error: false,
        num_turns: 2,
        result: 'Task completed successfully',
        total_cost_usd: 0.01,
        usage: {
          input_tokens: 200,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0
        },
        modelUsage: {},
        permission_denials: [],
        session_id: sessionId,
        uuid: '00000000-0000-0000-0000-000000000005'
      }
    ];

    fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));
  });

  afterEach(() => {
    const transcriptPath = TranscriptParser.getTranscriptPath(sessionId, testDir);
    if (fs.existsSync(transcriptPath)) {
      fs.unlinkSync(transcriptPath);
    }
  });

  describe('getSessionHistory', () => {
    it('should retrieve all messages from a session', async () => {
      const history = await getSessionHistory(sessionId, { cwd: testDir });

      expect(history).toHaveLength(5);
      expect(history[0].type).toBe('system');
      expect(history[1].type).toBe('user');
      expect(history[2].type).toBe('assistant');
      expect(history[3].type).toBe('user');
      expect(history[4].type).toBe('result');
    });

    it('should mark user messages as replay', async () => {
      const history = await getSessionHistory(sessionId, { cwd: testDir });

      const userMessages = history.filter(m => m.type === 'user');
      userMessages.forEach(msg => {
        expect(msg.isReplay).toBe(true);
      });
    });

    it('should filter by message types', async () => {
      const history = await getSessionHistory(sessionId, {
        cwd: testDir,
        filterTypes: ['user', 'assistant']
      });

      expect(history).toHaveLength(3);
      expect(history.every(m => m.type === 'user' || m.type === 'assistant')).toBe(true);
    });

    it('should support resuming from a specific message', async () => {
      const history = await getSessionHistory(sessionId, {
        cwd: testDir,
        resumeFromMessageId: '00000000-0000-0000-0000-000000000003'
      });

      // Should start from message 3 (assistant) onwards
      expect(history).toHaveLength(3);
      expect(history[0].uuid).toBe('00000000-0000-0000-0000-000000000003');
    });
  });

  describe('streamSessionHistory', () => {
    it('should stream messages one at a time', async () => {
      const collected = [];
      for await (const message of streamSessionHistory(sessionId, { cwd: testDir })) {
        collected.push(message);
      }

      expect(collected).toHaveLength(5);
      expect(collected[0].type).toBe('system');
    });

    it('should mark user messages as replay when streaming', async () => {
      const userMessages = [];
      for await (const message of streamSessionHistory(sessionId, { cwd: testDir })) {
        if (message.type === 'user') {
          userMessages.push(message);
        }
      }

      expect(userMessages).toHaveLength(2);
      userMessages.forEach(msg => {
        expect(msg.isReplay).toBe(true);
      });
    });

    it('should apply filters when streaming', async () => {
      const collected = [];
      for await (const message of streamSessionHistory(sessionId, {
        cwd: testDir,
        filterTypes: ['user', 'assistant']
      })) {
        collected.push(message);
      }

      expect(collected).toHaveLength(3);
      expect(collected.every(m => m.type === 'user' || m.type === 'assistant')).toBe(true);
    });
  });

  describe('getSessionInfo', () => {
    it('should return session metadata', async () => {
      const info = await getSessionInfo(sessionId, testDir);

      expect(info.sessionId).toBe(sessionId);
      expect(info.messageCount).toBe(5);
      expect(info.firstTimestamp).toBe('2025-01-01T10:00:00Z');
      expect(info.lastTimestamp).toBe('2025-01-01T10:00:05Z');
      expect(info.transcriptPath).toContain(sessionId + '.jsonl');
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        getSessionInfo('non-existent-session', testDir)
      ).rejects.toThrow('Transcript file not found');
    });
  });

  describe('sessionExists', () => {
    it('should return true for existing session', () => {
      const exists = sessionExists(sessionId, testDir);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent session', () => {
      const exists = sessionExists('non-existent-session', testDir);
      expect(exists).toBe(false);
    });
  });

  describe('getSessionTranscriptPath', () => {
    it('should return the correct path', () => {
      const transcriptPath = getSessionTranscriptPath(sessionId, testDir);
      
      expect(transcriptPath).toContain('.claude');
      expect(transcriptPath).toContain('projects');
      expect(transcriptPath).toContain(sessionId + '.jsonl');
    });

    it('should construct path that exists for real sessions', () => {
      const transcriptPath = getSessionTranscriptPath(sessionId, testDir);
      expect(fs.existsSync(transcriptPath)).toBe(true);
    });
  });
});
