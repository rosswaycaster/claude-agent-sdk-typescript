/**
 * Example: Resume Session with Context
 * 
 * This example shows how to resume a session while displaying
 * the previous conversation context to the user.
 */

import { query, getSessionHistory, getSessionInfo } from '@anthropic-ai/claude-agent-sdk';

async function resumeWithContext() {
  // The session ID you want to resume
  const sessionId = process.argv[2];

  if (!sessionId) {
    console.error('Usage: node resume-with-context.js <session-id>');
    process.exit(1);
  }

  // First, get session info
  console.log('=== Session Information ===\n');
  
  try {
    const info = await getSessionInfo(sessionId);
    console.log(`Session ID: ${info.sessionId}`);
    console.log(`Total Messages: ${info.messageCount}`);
    console.log(`Started: ${new Date(info.firstTimestamp).toLocaleString()}`);
    console.log(`Last Activity: ${new Date(info.lastTimestamp).toLocaleString()}`);
  } catch (error) {
    console.error('Session not found:', error.message);
    process.exit(1);
  }

  // Get recent conversation history
  console.log('\n=== Recent Conversation ===\n');
  
  const history = await getSessionHistory(sessionId, {
    filterTypes: ['user', 'assistant']
  });

  // Show last 3 turns (6 messages)
  const recentMessages = history.slice(-6);
  
  for (const message of recentMessages) {
    if (message.type === 'user') {
      console.log('?? You:', message.message.content);
    } else if (message.type === 'assistant') {
      const text = message.message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
      console.log('?? Claude:', text);
    }
    console.log();
  }

  // Now resume the session with a new prompt
  console.log('=== Resuming Session ===\n');
  
  const newPrompt = process.argv[3] || 'Continue with the next step';
  console.log(`New prompt: "${newPrompt}"\n`);

  const session = query({
    prompt: newPrompt,
    options: {
      resume: sessionId,
      maxTurns: 5
    }
  });

  // Process new messages
  for await (const message of session) {
    if (message.type === 'assistant') {
      console.log('\n?? Claude:');
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        }
      }
    } else if (message.type === 'result') {
      console.log('\n? Session complete');
      console.log(`Duration: ${message.duration_ms}ms`);
      console.log(`Total turns: ${message.num_turns}`);
    }
  }
}

resumeWithContext().catch(console.error);
