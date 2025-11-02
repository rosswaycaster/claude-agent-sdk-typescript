/**
 * Example: Sync all sessions to a database
 * 
 * This example demonstrates how to find and sync all Claude Agent SDK
 * session transcripts to a database.
 */

import { TranscriptParser } from '../lib/transcript-parser';

// Mock database interface (replace with your actual DB)
interface Database {
  sessions: {
    upsert(data: any): Promise<void>;
  };
  messages: {
    upsert(data: any): Promise<void>;
  };
}

// Simulated database
const db: Database = {
  sessions: {
    async upsert(data: any) {
      console.log('[DB] Upsert session:', data.sessionId);
    }
  },
  messages: {
    async upsert(data: any) {
      console.log('[DB] Upsert message:', data.uuid || data.id || 'no-id');
    }
  }
};

async function syncAllSessions() {
  console.log('Finding all transcript files...\n');
  
  const transcripts = TranscriptParser.findAllTranscripts();
  console.log(`Found ${transcripts.length} sessions\n`);

  for (const filePath of transcripts) {
    try {
      // Get session metadata
      const meta = await TranscriptParser.getMetadata(filePath);
      
      console.log(`Syncing session: ${meta.sessionId}`);
      console.log(`  Messages: ${meta.messageCount}`);
      console.log(`  Size: ${(meta.fileSize / 1024).toFixed(2)} KB`);
      console.log(`  Modified: ${meta.modifiedAt.toLocaleString()}`);

      // Upsert session record
      await db.sessions.upsert({
        sessionId: meta.sessionId,
        messageCount: meta.messageCount,
        fileSize: meta.fileSize,
        createdAt: meta.createdAt,
        modifiedAt: meta.modifiedAt,
        firstMessageType: meta.firstMessageType,
        lastMessageType: meta.lastMessageType
      });

      // Stream messages for memory efficiency
      let count = 0;
      for await (const message of TranscriptParser.stream(filePath)) {
        await db.messages.upsert({
          uuid: message.uuid || message.id,
          sessionId: message.session_id || meta.sessionId,
          type: message.type,
          data: message,
          createdAt: message.timestamp ? new Date(message.timestamp) : new Date()
        });
        count++;
      }

      console.log(`  ? Synced ${count} messages\n`);

    } catch (error) {
      console.error(`  ? Error syncing ${filePath}:`, error.message, '\n');
    }
  }

  console.log('Sync complete!');
}

// Run the sync
syncAllSessions().catch(console.error);
