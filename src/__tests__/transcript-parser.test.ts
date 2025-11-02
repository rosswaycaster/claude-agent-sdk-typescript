/**
 * Tests for Transcript Parser
 * 
 * This test file verifies the transcript parsing functionality works correctly
 * with various session transcript formats.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TranscriptParser, parseSessionTranscript, streamSessionTranscript, getSessionMetadata } from '../_internal/transcript-parser';
import type { TranscriptParseOptions } from '../_internal/types';

describe('TranscriptParser', () => {
  const testDir = path.join(os.tmpdir(), 'claude-sdk-test-' + Date.now());
  const projectSlug = 'workspace';
  const sessionId = 'test-session-id-123';
  const transcriptPath = path.join(testDir, '.claude', 'projects', projectSlug, `${sessionId}.jsonl`);

  beforeAll(() => {
    // Create test directory structure
    fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up transcript file before each test
    if (fs.existsSync(transcriptPath)) {
      fs.unlinkSync(transcriptPath);
    }
  });

  describe('getProjectSlug', () => {
    it('should convert absolute paths to slugs correctly', () => {
      expect(TranscriptParser.getProjectSlug('/workspace')).toBe('workspace');
      expect(TranscriptParser.getProjectSlug('/home/user/my-project')).toBe('home-user-my-project');
      expect(TranscriptParser.getProjectSlug('/Users/john/dev/test')).toBe('Users-john-dev-test');
    });

    it('should handle paths without leading slash', () => {
      expect(TranscriptParser.getProjectSlug('workspace')).toBe('workspace');
    });
  });

  describe('getTranscriptPath', () => {
    it('should construct correct transcript path', () => {
      const homeDir = os.homedir();
      const cwd = '/workspace';
      const sid = 'abc-123';
      
      const result = TranscriptParser.getTranscriptPath(sid, cwd);
      
      expect(result).toBe(path.join(homeDir, '.claude', 'projects', 'workspace', 'abc-123.jsonl'));
    });
  });

  describe('transcriptExists', () => {
    it('should return false when transcript does not exist', () => {
      const result = TranscriptParser.transcriptExists('non-existent-session', testDir);
      expect(result).toBe(false);
    });

    it('should return true when transcript exists', () => {
      // Create a test transcript
      const testTranscriptPath = path.join(testDir, '.claude', 'projects', 'test-dir', 'existing-session.jsonl');
      fs.mkdirSync(path.dirname(testTranscriptPath), { recursive: true });
      fs.writeFileSync(testTranscriptPath, '{"type":"system","subtype":"init"}\n');

      const result = TranscriptParser.transcriptExists('existing-session', testDir + '/test-dir');
      expect(result).toBe(true);
    });
  });

  describe('parseTranscriptFile', () => {
    it('should throw error when file does not exist', async () => {
      await expect(
        TranscriptParser.parseTranscriptFile('/non-existent/path.jsonl')
      ).rejects.toThrow('Transcript file not found');
    });

    it('should parse a valid transcript file', async () => {
      const messages = [
        { type: 'system', subtype: 'init', session_id: sessionId, uuid: 'uuid-1' },
        { type: 'user', message: { content: 'Hello' }, session_id: sessionId, uuid: 'uuid-2' },
        { type: 'assistant', message: { content: 'Hi there!' }, session_id: sessionId, uuid: 'uuid-3' },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parseTranscriptFile(transcriptPath);

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('system');
      expect(result[1].type).toBe('user');
      expect(result[2].type).toBe('assistant');
    });

    it('should skip empty lines', async () => {
      const content = `{"type":"user","message":{"content":"Hello"}}\n\n{"type":"assistant","message":{"content":"Hi"}}\n`;
      fs.writeFileSync(transcriptPath, content);

      const result = await TranscriptParser.parseTranscriptFile(transcriptPath);

      expect(result).toHaveLength(2);
    });

    it('should skip malformed lines and continue parsing', async () => {
      const content = `{"type":"user","message":{"content":"Hello"}}\n{invalid json\n{"type":"assistant","message":{"content":"Hi"}}\n`;
      fs.writeFileSync(transcriptPath, content);

      // Suppress console.warn for this test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      const result = await TranscriptParser.parseTranscriptFile(transcriptPath);

      expect(result).toHaveLength(2);
      expect(console.warn).toHaveBeenCalled();

      console.warn = originalWarn;
    });

    it('should mark user messages as replay when requested', async () => {
      const messages = [
        { type: 'user', message: { content: 'Hello' }, session_id: sessionId },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parseTranscriptFile(transcriptPath, {
        markAsReplay: true
      });

      expect(result[0].isReplay).toBe(true);
    });

    it('should not modify messages when markAsReplay is false', async () => {
      const messages = [
        { type: 'user', message: { content: 'Hello' }, session_id: sessionId },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parseTranscriptFile(transcriptPath, {
        markAsReplay: false
      });

      expect(result[0].isReplay).toBeUndefined();
    });

    it('should filter by message type', async () => {
      const messages = [
        { type: 'system', subtype: 'init', session_id: sessionId },
        { type: 'user', message: { content: 'Hello' }, session_id: sessionId },
        { type: 'assistant', message: { content: 'Hi' }, session_id: sessionId },
        { type: 'result', subtype: 'success', session_id: sessionId },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parseTranscriptFile(transcriptPath, {
        filterTypes: ['user', 'assistant']
      });

      expect(result).toHaveLength(2);
      expect(result.every(m => m.type === 'user' || m.type === 'assistant')).toBe(true);
    });

    it('should exclude file_snapshot messages by default', async () => {
      const messages = [
        { type: 'user', message: { content: 'Hello' }, session_id: sessionId },
        { type: 'file_snapshot', file_path: '/test.ts', content: 'code', session_id: sessionId },
        { type: 'assistant', message: { content: 'Hi' }, session_id: sessionId },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parseTranscriptFile(transcriptPath);

      expect(result).toHaveLength(2);
      expect(result.every(m => m.type !== 'file_snapshot')).toBe(true);
    });

    it('should include file_snapshot messages when requested', async () => {
      const messages = [
        { type: 'user', message: { content: 'Hello' }, session_id: sessionId },
        { type: 'file_snapshot', file_path: '/test.ts', content: 'code', session_id: sessionId },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parseTranscriptFile(transcriptPath, {
        includeFileSnapshots: true
      });

      expect(result).toHaveLength(2);
      expect(result[1].type).toBe('file_snapshot');
    });

    it('should resume from a specific message ID', async () => {
      const messages = [
        { type: 'user', message: { content: 'Hello' }, session_id: sessionId, uuid: 'msg-1' },
        { type: 'assistant', message: { content: 'Hi' }, session_id: sessionId, uuid: 'msg-2' },
        { type: 'user', message: { content: 'How are you?' }, session_id: sessionId, uuid: 'msg-3' },
        { type: 'assistant', message: { content: 'Good' }, session_id: sessionId, uuid: 'msg-4' },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parseTranscriptFile(transcriptPath, {
        resumeFromMessageId: 'msg-2'
      });

      // Should start from msg-2 (included) and get msg-2, msg-3, msg-4
      expect(result).toHaveLength(3);
      expect(result[0].uuid).toBe('msg-2');
      expect(result[1].uuid).toBe('msg-3');
      expect(result[2].uuid).toBe('msg-4');
    });
  });

  describe('getSessionMetadata', () => {
    it('should return correct metadata for a session', async () => {
      const messages = [
        { type: 'user', message: { content: 'Hello' }, timestamp: '2025-01-01T10:00:00Z' },
        { type: 'assistant', message: { content: 'Hi' }, timestamp: '2025-01-01T10:00:05Z' },
        { type: 'user', message: { content: 'Bye' }, timestamp: '2025-01-01T10:00:10Z' },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const metadata = await TranscriptParser.getSessionMetadata(sessionId, testDir + '/' + projectSlug);

      expect(metadata.sessionId).toBe(sessionId);
      expect(metadata.messageCount).toBe(3);
      expect(metadata.firstTimestamp).toBe('2025-01-01T10:00:00Z');
      expect(metadata.lastTimestamp).toBe('2025-01-01T10:00:10Z');
      expect(metadata.transcriptPath).toBe(transcriptPath);
    });

    it('should handle messages without timestamps', async () => {
      const messages = [
        { type: 'user', message: { content: 'Hello' } },
        { type: 'assistant', message: { content: 'Hi' } },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const metadata = await TranscriptParser.getSessionMetadata(sessionId, testDir + '/' + projectSlug);

      expect(metadata.messageCount).toBe(2);
      expect(metadata.firstTimestamp).toBeUndefined();
      expect(metadata.lastTimestamp).toBeUndefined();
    });
  });

  describe('streamTranscriptMessages', () => {
    it('should stream messages one by one', async () => {
      const messages = [
        { type: 'user', message: { content: 'Hello' }, session_id: sessionId },
        { type: 'assistant', message: { content: 'Hi' }, session_id: sessionId },
        { type: 'user', message: { content: 'Bye' }, session_id: sessionId },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const collected = [];
      for await (const message of TranscriptParser.streamTranscriptMessages(transcriptPath)) {
        collected.push(message);
      }

      expect(collected).toHaveLength(3);
      expect(collected[0].type).toBe('user');
      expect(collected[1].type).toBe('assistant');
      expect(collected[2].type).toBe('user');
    });

    it('should apply filters when streaming', async () => {
      const messages = [
        { type: 'system', subtype: 'init', session_id: sessionId },
        { type: 'user', message: { content: 'Hello' }, session_id: sessionId },
        { type: 'assistant', message: { content: 'Hi' }, session_id: sessionId },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const collected = [];
      for await (const message of TranscriptParser.streamTranscriptMessages(transcriptPath, {
        filterTypes: ['user', 'assistant']
      })) {
        collected.push(message);
      }

      expect(collected).toHaveLength(2);
      expect(collected.every(m => m.type === 'user' || m.type === 'assistant')).toBe(true);
    });
  });
});

describe('Convenience Functions', () => {
  const testDir = path.join(os.tmpdir(), 'claude-sdk-test-convenience-' + Date.now());

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('parseSessionTranscript', () => {
    it('should parse transcript by session ID', async () => {
      const sessionId = 'test-session-abc';
      const cwd = testDir + '/my-project';
      const transcriptPath = TranscriptParser.getTranscriptPath(sessionId, cwd);

      fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });

      const messages = [
        { type: 'user', message: { content: 'Hello' } },
        { type: 'assistant', message: { content: 'Hi' } },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await parseSessionTranscript(sessionId, {}, cwd);

      expect(result).toHaveLength(2);
    });
  });

  describe('streamSessionTranscript', () => {
    it('should stream transcript by session ID', async () => {
      const sessionId = 'test-session-xyz';
      const cwd = testDir + '/another-project';
      const transcriptPath = TranscriptParser.getTranscriptPath(sessionId, cwd);

      fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });

      const messages = [
        { type: 'user', message: { content: 'Test' } },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const collected = [];
      for await (const message of streamSessionTranscript(sessionId, {}, cwd)) {
        collected.push(message);
      }

      expect(collected).toHaveLength(1);
      expect(collected[0].type).toBe('user');
    });
  });
});
