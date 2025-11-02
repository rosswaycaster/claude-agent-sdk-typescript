/**
 * Example: Session Analytics
 * 
 * This example demonstrates how to analyze session metrics and patterns
 * to gain insights into Claude Code usage.
 */

import { getSessionHistory, getSessionInfo } from '@anthropic-ai/claude-agent-sdk';

interface SessionAnalytics {
  sessionId: string;
  duration: number;
  totalCost: number;
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  systemMessages: number;
  toolUses: number;
  toolsByName: Record<string, number>;
  errors: number;
  turns: number;
  tokensUsed: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  };
  averageResponseTime?: number;
  successRate: number;
}

async function analyzeSession(sessionId: string): Promise<SessionAnalytics> {
  const info = await getSessionInfo(sessionId);
  const history = await getSessionHistory(sessionId);

  const analytics: SessionAnalytics = {
    sessionId,
    duration: 0,
    totalCost: 0,
    messageCount: history.length,
    userMessages: 0,
    assistantMessages: 0,
    systemMessages: 0,
    toolUses: 0,
    toolsByName: {},
    errors: 0,
    turns: 0,
    tokensUsed: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreation: 0
    },
    successRate: 0
  };

  let responseTimes: number[] = [];
  let lastUserTime: Date | null = null;

  for (const message of history) {
    if (message.type === 'user') {
      analytics.userMessages++;
      if (message.timestamp) {
        lastUserTime = new Date(message.timestamp);
      }
    } else if (message.type === 'assistant') {
      analytics.assistantMessages++;
      
      // Calculate response time
      if (lastUserTime && message.timestamp) {
        const responseTime = new Date(message.timestamp).getTime() - lastUserTime.getTime();
        responseTimes.push(responseTime);
        lastUserTime = null;
      }

      // Count tool uses
      for (const block of message.message.content) {
        if (block.type === 'tool_use') {
          analytics.toolUses++;
          analytics.toolsByName[block.name] = (analytics.toolsByName[block.name] || 0) + 1;
        }
      }

      // Track token usage
      if (message.message.usage) {
        analytics.tokensUsed.input += message.message.usage.input_tokens || 0;
        analytics.tokensUsed.output += message.message.usage.output_tokens || 0;
        analytics.tokensUsed.cacheRead += message.message.usage.cache_read_input_tokens || 0;
        analytics.tokensUsed.cacheCreation += message.message.usage.cache_creation_input_tokens || 0;
      }
    } else if (message.type === 'system') {
      analytics.systemMessages++;
    } else if (message.type === 'result') {
      analytics.duration = message.duration_ms;
      analytics.totalCost = message.total_cost_usd;
      analytics.turns = message.num_turns;
      
      if (message.is_error) {
        analytics.errors++;
      }
      
      analytics.successRate = message.subtype === 'success' ? 1 : 0;
    }
  }

  // Calculate average response time
  if (responseTimes.length > 0) {
    analytics.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  }

  return analytics;
}

function displayAnalytics(analytics: SessionAnalytics) {
  console.log('\n?? Session Analytics\n');
  console.log('='.repeat(50));
  
  console.log('\n?? Basic Info');
  console.log(`Session ID: ${analytics.sessionId}`);
  console.log(`Duration: ${(analytics.duration / 1000).toFixed(2)}s`);
  console.log(`Total Cost: $${analytics.totalCost.toFixed(4)}`);
  console.log(`Success Rate: ${(analytics.successRate * 100).toFixed(0)}%`);
  
  console.log('\n?? Messages');
  console.log(`Total: ${analytics.messageCount}`);
  console.log(`User: ${analytics.userMessages}`);
  console.log(`Assistant: ${analytics.assistantMessages}`);
  console.log(`System: ${analytics.systemMessages}`);
  console.log(`Turns: ${analytics.turns}`);
  
  if (analytics.averageResponseTime) {
    console.log(`\nAvg Response Time: ${(analytics.averageResponseTime / 1000).toFixed(2)}s`);
  }
  
  console.log('\n?? Tool Usage');
  console.log(`Total Tool Uses: ${analytics.toolUses}`);
  
  if (Object.keys(analytics.toolsByName).length > 0) {
    console.log('\nTools by name:');
    const sorted = Object.entries(analytics.toolsByName)
      .sort((a, b) => b[1] - a[1]);
    
    for (const [tool, count] of sorted) {
      console.log(`  ${tool}: ${count}`);
    }
  }
  
  console.log('\n?? Token Usage');
  console.log(`Input: ${analytics.tokensUsed.input.toLocaleString()}`);
  console.log(`Output: ${analytics.tokensUsed.output.toLocaleString()}`);
  console.log(`Cache Read: ${analytics.tokensUsed.cacheRead.toLocaleString()}`);
  console.log(`Cache Creation: ${analytics.tokensUsed.cacheCreation.toLocaleString()}`);
  console.log(`Total: ${(
    analytics.tokensUsed.input + 
    analytics.tokensUsed.output + 
    analytics.tokensUsed.cacheRead + 
    analytics.tokensUsed.cacheCreation
  ).toLocaleString()}`);
  
  if (analytics.errors > 0) {
    console.log(`\n??  Errors: ${analytics.errors}`);
  }
  
  console.log('\n' + '='.repeat(50));
}

// CLI usage
const sessionId = process.argv[2];

if (!sessionId) {
  console.error('Usage: node session-analytics.js <session-id>');
  process.exit(1);
}

analyzeSession(sessionId)
  .then(analytics => {
    displayAnalytics(analytics);
  })
  .catch(error => {
    console.error('Error analyzing session:', error.message);
    process.exit(1);
  });
