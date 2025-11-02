/**
 * Tests for Claude Agent SDK Transcript Parser
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TranscriptParser, parseTranscript, streamTranscript } from '../lib/transcript-parser';
import type { TranscriptMessage, ParseOptions } from '../lib/transcript-parser';

describe('TranscriptParser', () => {
  const testDir = path.join(os.tmpdir(), 'transcript-parser-test-' + Date.now());
  let testTranscriptPath: string;

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    testTranscriptPath = path.join(testDir, 'test-session.jsonl');
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    if (fs.existsSync(testTranscriptPath)) {
      fs.unlinkSync(testTranscriptPath);
    }
  });

  describe('parse()', () => {
    it('should parse a valid transcript file', async () => {
      const messages = [
        { type: 'system', subtype: 'init', uuid: '1' },
        { type: 'user', message: { content: 'Hello' }, uuid: '2' },
        { type: 'assistant', message: { content: 'Hi' }, uuid: '3' },
      ];

      fs.writeFileSync(testTranscriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parse(testTranscriptPath);

      expect(result.messages).toHaveLength(3);
      expect(result.metadata.parsedMessages).toBe(3);
      expect(result.metadata.totalLines).toBe(3);
      expect(result.metadata.skippedLines).toBe(0);
      expect(result.metadata.errors).toHaveLength(0);
    });

    it('should throw error if file does not exist', async () => {
      await expect(
        TranscriptParser.parse('/nonexistent/file.jsonl')
      ).rejects.toThrow('Transcript file not found');
    });

    it('should skip empty lines', async () => {
      const content = `{"type":"user","message":{"content":"Hello"}}\n\n\n{"type":"assistant","message":{"content":"Hi"}}\n`;
      fs.writeFileSync(testTranscriptPath, content);

      const result = await TranscriptParser.parse(testTranscriptPath);

      expect(result.messages).toHaveLength(2);
      expect(result.metadata.skippedLines).toBe(3);
    });

    it('should skip malformed lines by default', async () => {
      const content = `{"type":"user","message":{"content":"Hello"}}\n{invalid json\n{"type":"assistant","message":{"content":"Hi"}}\n`;
      fs.writeFileSync(testTranscriptPath, content);

      const result = await TranscriptParser.parse(testTranscriptPath);

      expect(result.messages).toHaveLength(2);
      expect(result.metadata.errors).toHaveLength(1);
      expect(result.metadata.errors[0].line).toBe(2);
    });

    it('should throw error on malformed lines when skipMalformed=false', async () => {
      const content = `{"type":"user","message":{"content":"Hello"}}\n{invalid json\n`;
      fs.writeFileSync(testTranscriptPath, content);

      await expect(
        TranscriptParser.parse(testTranscriptPath, { skipMalformed: false })
      ).rejects.toThrow('Failed to parse line 2');
    });

    it('should filter by message types', async () => {
      const messages = [
        { type: 'system', subtype: 'init' },
        { type: 'user', message: { content: 'Hello' } },
        { type: 'assistant', message: { content: 'Hi' } },
        { type: 'result', subtype: 'success' },
      ];

      fs.writeFileSync(testTranscriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parse(testTranscriptPath, {
        filterTypes: ['user', 'assistant']
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages.every(m => m.type === 'user' || m.type === 'assistant')).toBe(true);
    });

    it('should start from a specific message ID', async () => {
      const messages = [
        { type: 'user', message: { content: 'First' }, uuid: 'msg-1' },
        { type: 'assistant', message: { content: 'Second' }, uuid: 'msg-2' },
        { type: 'user', message: { content: 'Third' }, uuid: 'msg-3' },
        { type: 'assistant', message: { content: 'Fourth' }, uuid: 'msg-4' },
      ];

      fs.writeFileSync(testTranscriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parse(testTranscriptPath, {
        startFromMessageId: 'msg-2'
      });

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].uuid).toBe('msg-2');
      expect(result.messages[2].uuid).toBe('msg-4');
    });

    it('should stop at a specific message ID', async () => {
      const messages = [
        { type: 'user', uuid: 'msg-1' },
        { type: 'assistant', uuid: 'msg-2' },
        { type: 'user', uuid: 'msg-3' },
        { type: 'assistant', uuid: 'msg-4' },
      ];

      fs.writeFileSync(testTranscriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parse(testTranscriptPath, {
        stopAtMessageId: 'msg-2'
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].uuid).toBe('msg-2');
    });

    it('should respect limit option', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        type: 'user',
        message: { content: `Message ${i}` }
      }));

      fs.writeFileSync(testTranscriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parse(testTranscriptPath, { limit: 5 });

      expect(result.messages).toHaveLength(5);
    });

    it('should handle complex message structures', async () => {
      const messages = [
        {
          type: 'assistant',
          message: {
            id: 'msg_123',
            role: 'assistant',
            content: [
              { type: 'text', text: 'Hello' },
              { type: 'tool_use', id: 'tool_1', name: 'read_file', input: { path: 'test.ts' } }
            ],
            model: 'claude-sonnet-4.5',
            usage: { input_tokens: 100, output_tokens: 50 }
          },
          uuid: 'uuid-123',
          session_id: 'session-abc'
        }
      ];

      fs.writeFileSync(testTranscriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await TranscriptParser.parse(testTranscriptPath);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].message.content).toHaveLength(2);
      expect(result.messages[0].message.usage.input_tokens).toBe(100);
    });
  });

  describe('stream()', () => {
    it('should stream messages one by one', async () => {
      const messages = [
        { type: 'user', message: { content: 'First' } },
        { type: 'assistant', message: { content: 'Second' } },
        { type: 'user', message: { content: 'Third' } },
      ];

      fs.writeFileSync(testTranscriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const collected: TranscriptMessage[] = [];
      for await (const message of TranscriptParser.stream(testTranscriptPath)) {
        collected.push(message);
      }

      expect(collected).toHaveLength(3);
      expect(collected[0].type).toBe('user');
      expect(collected[1].type).toBe('assistant');
    });

    it('should apply filters when streaming', async () => {
      const messages = [
        { type: 'system', subtype: 'init' },
        { type: 'user', message: { content: 'Hello' } },
        { type: 'assistant', message: { content: 'Hi' } },
      ];

      fs.writeFileSync(testTranscriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const collected: TranscriptMessage[] = [];
      for await (const message of TranscriptParser.stream(testTranscriptPath, {
        filterTypes: ['user', 'assistant']
      })) {
        collected.push(message);
      }

      expect(collected).toHaveLength(2);
      expect(collected.every(m => m.type === 'user' || m.type === 'assistant')).toBe(true);
    });

    it('should respect limit when streaming', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({ type: 'user', index: i }));
      fs.writeFileSync(testTranscriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const collected: TranscriptMessage[] = [];
      for await (const message of TranscriptParser.stream(testTranscriptPath, { limit: 3 })) {
        collected.push(message);
      }

      expect(collected).toHaveLength(3);
    });
  });

  describe('getMetadata()', () => {
    it('should return correct metadata', async () => {
      const messages = [
        { type: 'system', subtype: 'init' },
        { type: 'user', message: { content: 'Hello' } },
        { type: 'assistant', message: { content: 'Hi' } },
      ];

      fs.writeFileSync(testTranscriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const metadata = await TranscriptParser.getMetadata(testTranscriptPath);

      expect(metadata.sessionId).toBe('test-session');
      expect(metadata.messageCount).toBe(3);
      expect(metadata.firstMessageType).toBe('system');
      expect(metadata.lastMessageType).toBe('assistant');
      expect(metadata.fileSize).toBeGreaterThan(0);
      expect(metadata.filePath).toBe(testTranscriptPath);
      expect(metadata.createdAt).toBeInstanceOf(Date);
      expect(metadata.modifiedAt).toBeInstanceOf(Date);
    });

    it('should handle empty files', async () => {
      fs.writeFileSync(testTranscriptPath, '');

      const metadata = await TranscriptParser.getMetadata(testTranscriptPath);

      expect(metadata.messageCount).toBe(0);
      expect(metadata.firstMessageType).toBeUndefined();
      expect(metadata.lastMessageType).toBeUndefined();
    });
  });

  describe('getProjectSlug()', () => {
    it('should convert paths to slugs correctly', () => {
      expect(TranscriptParser.getProjectSlug('/workspace')).toBe('workspace');
      expect(TranscriptParser.getProjectSlug('/home/user/my-project')).toBe('home-user-my-project');
      expect(TranscriptParser.getProjectSlug('/Users/john/dev/test')).toBe('Users-john-dev-test');
    });

    it('should handle paths without leading slash', () => {
      expect(TranscriptParser.getProjectSlug('workspace')).toBe('workspace');
      expect(TranscriptParser.getProjectSlug('my-project')).toBe('my-project');
    });
  });

  describe('getTranscriptPath()', () => {
    it('should construct correct transcript path', () => {
      const homeDir = os.homedir();
      const result = TranscriptParser.getTranscriptPath('session-123', '/workspace');

      expect(result).toBe(path.join(homeDir, '.claude', 'projects', 'workspace', 'session-123.jsonl'));
    });
  });

  describe('findAllTranscripts()', () => {
    it('should find all transcript files', () => {
      const claudeDir = path.join(testDir, '.claude', 'projects');
      fs.mkdirSync(path.join(claudeDir, 'project-1'), { recursive: true });
      fs.mkdirSync(path.join(claudeDir, 'project-2'), { recursive: true });

      fs.writeFileSync(path.join(claudeDir, 'project-1', 'session-1.jsonl'), '{}');
      fs.writeFileSync(path.join(claudeDir, 'project-1', 'session-2.jsonl'), '{}');
      fs.writeFileSync(path.join(claudeDir, 'project-2', 'session-3.jsonl'), '{}');
      fs.writeFileSync(path.join(claudeDir, 'project-2', 'other-file.txt'), 'text');

      // Temporarily replace homedir for this test
      const originalHomedir = os.homedir;
      os.homedir = () => testDir;

      try {
        const transcripts = TranscriptParser.findAllTranscripts();
        expect(transcripts).toHaveLength(3);
        expect(transcripts.every(t => t.endsWith('.jsonl'))).toBe(true);
      } finally {
        os.homedir = originalHomedir;
      }
    });

    it('should return empty array if projects directory does not exist', () => {
      const originalHomedir = os.homedir;
      os.homedir = () => '/nonexistent/directory';

      try {
        const transcripts = TranscriptParser.findAllTranscripts();
        expect(transcripts).toHaveLength(0);
      } finally {
        os.homedir = originalHomedir;
      }
    });
  });
});

describe('Convenience Functions', () => {
  const testDir = path.join(os.tmpdir(), 'transcript-parser-convenience-' + Date.now());

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('parseTranscript()', () => {
    it('should parse transcript by session ID', async () => {
      const sessionId = 'test-session-abc';
      const transcriptPath = TranscriptParser.getTranscriptPath(sessionId, testDir);

      fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });

      const messages = [
        { type: 'user', message: { content: 'Hello' } },
        { type: 'assistant', message: { content: 'Hi' } },
      ];

      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const result = await parseTranscript(sessionId, {}, testDir);

      expect(result.messages).toHaveLength(2);
    });
  });

  describe('streamTranscript()', () => {
    it('should stream transcript by session ID', async () => {
      const sessionId = 'test-session-xyz';
      const transcriptPath = TranscriptParser.getTranscriptPath(sessionId, testDir);

      fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });

      const messages = [{ type: 'user', message: { content: 'Test' } }];
      fs.writeFileSync(transcriptPath, messages.map(m => JSON.stringify(m)).join('\n'));

      const collected: TranscriptMessage[] = [];
      for await (const message of streamTranscript(sessionId, {}, testDir)) {
        collected.push(message);
      }

      expect(collected).toHaveLength(1);
      expect(collected[0].type).toBe('user');
    });
  });
});
