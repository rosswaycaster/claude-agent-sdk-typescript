/**
 * Example: Monitor active sessions
 * 
 * Watch for recently modified sessions and process them.
 */

import { TranscriptParser } from '../lib/transcript-parser';

async function monitorActiveSessions(maxAgeMinutes: number = 60) {
  console.log(`Monitoring for sessions modified in the last ${maxAgeMinutes} minutes...\n`);

  const transcripts = TranscriptParser.findAllTranscripts();
  const threshold = Date.now() - (maxAgeMinutes * 60 * 1000);

  const activeSessions = [];

  for (const filePath of transcripts) {
    try {
      const meta = await TranscriptParser.getMetadata(filePath);
      
      if (meta.modifiedAt.getTime() > threshold) {
        activeSessions.push({ filePath, meta });
      }
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error.message);
    }
  }

  if (activeSessions.length === 0) {
    console.log('No active sessions found.');
    return;
  }

  console.log(`Found ${activeSessions.length} active session(s):\n`);

  for (const { filePath, meta } of activeSessions) {
    const ageMinutes = Math.floor((Date.now() - meta.modifiedAt.getTime()) / 60000);
    
    console.log(`?? ${meta.sessionId}`);
    console.log(`   Messages: ${meta.messageCount}`);
    console.log(`   Last modified: ${ageMinutes} minute(s) ago`);
    console.log(`   File: ${filePath}`);

    // Parse the last few messages to see what's happening
    const result = await TranscriptParser.parse(filePath, {
      filterTypes: ['user', 'assistant', 'result']
    });

    const recent = result.messages.slice(-3);
    
    console.log('   Recent activity:');
    for (const msg of recent) {
      if (msg.type === 'user') {
        const content = typeof msg.message?.content === 'string' 
          ? msg.message.content 
          : 'Complex message';
        console.log(`     ?? User: ${content.substring(0, 60)}...`);
      } else if (msg.type === 'assistant') {
        const text = msg.message?.content
          ?.filter(b => b.type === 'text')
          .map(b => b.text)
          .join(' ')
          .substring(0, 60) || 'Assistant message';
        console.log(`     ?? Assistant: ${text}...`);
      } else if (msg.type === 'result') {
        console.log(`     ? Result: ${msg.subtype}`);
      }
    }
    
    console.log();
  }
}

// Run with optional age parameter
const maxAgeMinutes = parseInt(process.argv[2]) || 60;
monitorActiveSessions(maxAgeMinutes).catch(console.error);
