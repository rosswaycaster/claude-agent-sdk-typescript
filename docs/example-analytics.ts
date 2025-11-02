/**
 * Example: Generate session analytics
 * 
 * Parse a session and generate detailed analytics about its usage.
 */

import { TranscriptParser, parseTranscript } from '../lib/transcript-parser';

interface SessionAnalytics {
  sessionId: string;
  messageCount: number;
  messagesByType: Record<string, number>;
  userMessages: number;
  assistantMessages: number;
  toolUses: number;
  toolsByName: Record<string, number>;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  duration?: number;
  cost?: number;
  success: boolean;
  errors: string[];
}

async function analyzeSession(filePath: string): Promise<SessionAnalytics> {
  const result = await TranscriptParser.parse(filePath);
  
  const analytics: SessionAnalytics = {
    sessionId: '',
    messageCount: result.messages.length,
    messagesByType: {},
    userMessages: 0,
    assistantMessages: 0,
    toolUses: 0,
    toolsByName: {},
    tokensUsed: {
      input: 0,
      output: 0,
      total: 0
    },
    success: false,
    errors: []
  };

  for (const message of result.messages) {
    // Track session ID
    if (message.session_id && !analytics.sessionId) {
      analytics.sessionId = message.session_id;
    }

    // Count by type
    analytics.messagesByType[message.type] = (analytics.messagesByType[message.type] || 0) + 1;

    // Count user/assistant messages
    if (message.type === 'user') {
      analytics.userMessages++;
    } else if (message.type === 'assistant') {
      analytics.assistantMessages++;

      // Count tool uses
      if (message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === 'tool_use') {
            analytics.toolUses++;
            const toolName = block.name;
            analytics.toolsByName[toolName] = (analytics.toolsByName[toolName] || 0) + 1;
          }
        }
      }

      // Track token usage
      if (message.message?.usage) {
        analytics.tokensUsed.input += message.message.usage.input_tokens || 0;
        analytics.tokensUsed.output += message.message.usage.output_tokens || 0;
      }
    } else if (message.type === 'result') {
      // Extract session results
      analytics.duration = message.duration_ms;
      analytics.cost = message.total_cost_usd;
      analytics.success = message.subtype === 'success';

      if (message.errors && Array.isArray(message.errors)) {
        analytics.errors = message.errors;
      }
    }
  }

  analytics.tokensUsed.total = analytics.tokensUsed.input + analytics.tokensUsed.output;

  return analytics;
}

function displayAnalytics(analytics: SessionAnalytics) {
  console.log('\n' + '='.repeat(60));
  console.log('SESSION ANALYTICS');
  console.log('='.repeat(60));
  
  console.log('\n?? Basic Info');
  console.log(`  Session ID: ${analytics.sessionId}`);
  console.log(`  Total Messages: ${analytics.messageCount}`);
  console.log(`  Status: ${analytics.success ? '? Success' : '? Failed'}`);
  
  if (analytics.duration) {
    console.log(`  Duration: ${(analytics.duration / 1000).toFixed(2)}s`);
  }
  
  if (analytics.cost) {
    console.log(`  Cost: $${analytics.cost.toFixed(4)}`);
  }

  console.log('\n?? Conversation');
  console.log(`  User Messages: ${analytics.userMessages}`);
  console.log(`  Assistant Messages: ${analytics.assistantMessages}`);
  console.log(`  Turns: ${Math.min(analytics.userMessages, analytics.assistantMessages)}`);

  console.log('\n?? Message Types');
  Object.entries(analytics.messagesByType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  if (analytics.toolUses > 0) {
    console.log('\n?? Tool Usage');
    console.log(`  Total Tool Uses: ${analytics.toolUses}`);
    Object.entries(analytics.toolsByName)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tool, count]) => {
        console.log(`    ${tool}: ${count}`);
      });
  }

  console.log('\n?? Token Usage');
  console.log(`  Input: ${analytics.tokensUsed.input.toLocaleString()}`);
  console.log(`  Output: ${analytics.tokensUsed.output.toLocaleString()}`);
  console.log(`  Total: ${analytics.tokensUsed.total.toLocaleString()}`);

  if (analytics.errors.length > 0) {
    console.log('\n??  Errors');
    analytics.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// CLI usage
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node example-analytics.js <transcript-file>');
  console.error('Example: node example-analytics.js ~/.claude/projects/workspace/session-123.jsonl');
  process.exit(1);
}

analyzeSession(filePath)
  .then(displayAnalytics)
  .catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
