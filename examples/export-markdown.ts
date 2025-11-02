/**
 * Example: Export Session to Markdown
 * 
 * This example shows how to export a Claude Code session to a
 * readable Markdown file for documentation or sharing.
 */

import { getSessionHistory, getSessionInfo } from '@anthropic-ai/claude-agent-sdk';
import { writeFileSync } from 'fs';

async function exportToMarkdown(sessionId: string, outputPath: string) {
  console.log(`Exporting session ${sessionId} to ${outputPath}...`);

  // Get session info
  const info = await getSessionInfo(sessionId);

  // Get full history
  const history = await getSessionHistory(sessionId);

  // Build markdown content
  let markdown = `# Claude Code Session\n\n`;
  markdown += `**Session ID:** ${sessionId}\n\n`;
  markdown += `**Started:** ${new Date(info.firstTimestamp).toLocaleString()}\n\n`;
  markdown += `**Ended:** ${new Date(info.lastTimestamp).toLocaleString()}\n\n`;
  markdown += `**Total Messages:** ${info.messageCount}\n\n`;
  markdown += `---\n\n`;

  // Process messages
  for (const message of history) {
    if (message.type === 'system' && message.subtype === 'init') {
      markdown += `## Session Configuration\n\n`;
      markdown += `- **Model:** ${message.model}\n`;
      markdown += `- **CWD:** ${message.cwd}\n`;
      markdown += `- **Permission Mode:** ${message.permissionMode}\n`;
      markdown += `- **Tools:** ${message.tools.join(', ')}\n`;
      
      if (message.skills && message.skills.length > 0) {
        markdown += `- **Skills:** ${message.skills.join(', ')}\n`;
      }
      
      if (message.mcp_servers && message.mcp_servers.length > 0) {
        markdown += `- **MCP Servers:** ${message.mcp_servers.map(s => s.name).join(', ')}\n`;
      }
      
      markdown += `\n---\n\n`;
    } else if (message.type === 'user') {
      markdown += `### ?? User\n\n`;
      
      if (typeof message.message.content === 'string') {
        markdown += `${message.message.content}\n\n`;
      } else if (Array.isArray(message.message.content)) {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            markdown += `${block.text}\n\n`;
          } else if (block.type === 'tool_result') {
            markdown += `\`\`\`\n${block.content}\n\`\`\`\n\n`;
          }
        }
      }
    } else if (message.type === 'assistant') {
      markdown += `### ?? Assistant\n\n`;
      
      for (const block of message.message.content) {
        if (block.type === 'text') {
          markdown += `${block.text}\n\n`;
        } else if (block.type === 'thinking') {
          markdown += `<details>\n<summary>?? Thinking Process</summary>\n\n`;
          markdown += `\`\`\`\n${block.thinking}\n\`\`\`\n\n`;
          markdown += `</details>\n\n`;
        } else if (block.type === 'tool_use') {
          markdown += `**?? Tool Use:** \`${block.name}\`\n\n`;
          markdown += `\`\`\`json\n${JSON.stringify(block.input, null, 2)}\n\`\`\`\n\n`;
        }
      }
    } else if (message.type === 'result') {
      markdown += `---\n\n`;
      markdown += `## Session Result\n\n`;
      markdown += `- **Status:** ${message.subtype}\n`;
      markdown += `- **Duration:** ${(message.duration_ms / 1000).toFixed(2)}s\n`;
      markdown += `- **API Time:** ${(message.duration_api_ms / 1000).toFixed(2)}s\n`;
      markdown += `- **Turns:** ${message.num_turns}\n`;
      markdown += `- **Cost:** $${message.total_cost_usd.toFixed(4)}\n`;
      
      if (message.subtype === 'success' && message.result) {
        markdown += `- **Result:** ${message.result}\n`;
      }
      
      if (message.subtype !== 'success' && 'errors' in message && message.errors) {
        markdown += `\n### Errors\n\n`;
        for (const error of message.errors) {
          markdown += `- ${error}\n`;
        }
      }
      
      markdown += `\n`;
    } else if (message.type === 'system' && message.subtype === 'compact_boundary') {
      markdown += `---\n\n`;
      markdown += `**? Context Compacted** (${message.compact_metadata.trigger})\n\n`;
      markdown += `Previous tokens: ${message.compact_metadata.pre_tokens}\n\n`;
      markdown += `---\n\n`;
    }
  }

  // Write to file
  writeFileSync(outputPath, markdown);
  console.log(`? Exported to ${outputPath}`);
  console.log(`   Total size: ${Buffer.byteLength(markdown)} bytes`);
}

// CLI usage
const sessionId = process.argv[2];
const outputPath = process.argv[3] || `session-${sessionId}.md`;

if (!sessionId) {
  console.error('Usage: node export-markdown.js <session-id> [output-path]');
  process.exit(1);
}

exportToMarkdown(sessionId, outputPath).catch(console.error);
