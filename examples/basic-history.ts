/**
 * Example: Basic Session History Retrieval
 * 
 * This example demonstrates how to retrieve and display the full conversation
 * history from a completed Claude Code session.
 */

import { query, getSessionHistory } from '@anthropic-ai/claude-agent-sdk';

async function basicExample() {
  console.log('=== Starting Claude Code Session ===\n');

  // Start a new session
  const session = query({
    prompt: "Create a simple hello world script in Python",
    options: {
      maxTurns: 2
    }
  });

  let sessionId: string | undefined;

  // Process the session
  for await (const message of session) {
    // Capture the session ID
    if (message.session_id) {
      sessionId = message.session_id;
    }

    // Display message types
    console.log(`[${message.type}]`, message);
  }

  if (!sessionId) {
    console.error('No session ID found');
    return;
  }

  console.log('\n=== Session Complete ===\n');
  console.log('Session ID:', sessionId);

  // Now retrieve the full history
  console.log('\n=== Retrieving Session History ===\n');
  
  const history = await getSessionHistory(sessionId);
  
  console.log(`Found ${history.length} messages in history\n`);

  // Display the conversation
  for (const message of history) {
    if (message.type === 'user' && message.isReplay) {
      console.log('\n?? User:', message.message.content);
    } else if (message.type === 'assistant') {
      console.log('\n?? Assistant:');
      for (const block of message.message.content) {
        if (block.type === 'text') {
          console.log(block.text);
        } else if (block.type === 'tool_use') {
          console.log(`[Using tool: ${block.name}]`);
        }
      }
    } else if (message.type === 'system' && message.subtype === 'init') {
      console.log('\n??  System initialized');
      console.log(`   Model: ${message.model}`);
      console.log(`   Tools: ${message.tools.join(', ')}`);
    } else if (message.type === 'result') {
      console.log('\n? Result:', message.subtype);
      console.log(`   Duration: ${message.duration_ms}ms`);
      console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
      console.log(`   Turns: ${message.num_turns}`);
    }
  }
}

// Run the example
basicExample().catch(console.error);
