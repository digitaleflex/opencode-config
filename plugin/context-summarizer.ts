// Simple context summarizer plugin for OpenCode
// This plugin summarizes conversation context every N turns to keep token usage low
// Basic implementation - can be extended with actual summarization logic
export default async function (input, options) {
  const { session, config } = input;
  const interval = config?.interval || 10;
  
  const messages = session.messages || [];
  const userMessages = messages.filter(m => m.role === "user");
  
  if (userMessages.length === 0 || userMessages.length % interval !== 0) {
    return {};
  }
  
  // Estimate token count
  const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const estimatedTokens = Math.ceil(totalChars / 4);
  
  // Auto-prune if getting too large
  if (estimatedTokens > (config?.maxTokens || 30000)) {
    console.log(`[Context Summarizer] Context large (${estimatedTokens} tokens), pruning old messages...`);
    
    // Keep only recent messages plus the last 5 user turns
    const keepRecent = Math.max(20, messages.length - 100);
    session.messages = messages.slice(keepRecent);
    
    console.log(`[Context Summarizer] Pruned to ${session.messages.length} messages`);
  }
  
  return {};
}