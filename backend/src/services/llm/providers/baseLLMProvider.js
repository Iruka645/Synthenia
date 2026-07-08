class BaseLLMProvider {
  /**
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options - { model, temperature, top_p, num_predict }
   * @returns {Promise<{reply: string, emotion: string}>}
   */
  async chat(messages, options = {}) {
    throw new Error("Method 'chat(messages, options)' must be implemented.");
  }

  /**
   * Parses the raw model output into a structured { reply, emotion } object.
   * @param {string} rawContent 
   * @returns {{reply: string, emotion: string}}
   */
  _parseContent(rawContent) {
    if (!rawContent || typeof rawContent !== 'string' || !rawContent.trim()) {
      throw new Error("Empty or invalid raw content returned from model");
    }

    let aiContent = rawContent.trim();
    if (aiContent.includes('```')) {
      const match = aiContent.match(/```(?:json)?([\s\S]*?)```/);
      if (match) aiContent = match[1].trim();
    }

    try {
      const parsed = JSON.parse(aiContent);
      let parsedObj = parsed;
      
      if (Array.isArray(parsed)) {
        if (parsed.length > 0) {
          parsedObj = parsed[0];
        } else {
          throw new Error("Empty JSON array returned from model");
        }
      }

      if (typeof parsedObj === 'object' && parsedObj !== null) {
        // Check for reasoning/thinking block without actual reply
        const reasoningKeys = ['analysis', 'thinking', 'thought', 'reasoning', 'plan'];
        const hasReasoning = reasoningKeys.some(k => k in parsedObj);
        const replyKeys = ['reply', 'response', 'content', 'text', 'message', 'assistant', 'say'];
        const hasReply = replyKeys.some(k => k in parsedObj);

        if (hasReasoning && !hasReply) {
          throw new Error(`Model returned thinking/analysis block instead of reply: ${JSON.stringify(parsedObj)}`);
        }

        let reply = parsedObj.reply || parsedObj.response || parsedObj.content || parsedObj.text || parsedObj.message || parsedObj.assistant || parsedObj.say;
        let emotion = parsedObj.emotion || parsedObj.emotion_tag || parsedObj.mood || 'neutral';

        if (!reply) {
          const values = Object.values(parsedObj);
          const strVal = values.find(v => typeof v === 'string');
          if (strVal) {
            reply = strVal;
          } else if (values.length > 0) {
            reply = JSON.stringify(parsedObj);
          }
        }

        if (!reply || typeof reply !== 'string' || !reply.trim()) {
          throw new Error("Reply content is empty after JSON parsing");
        }

        return {
          reply: String(reply).trim(),
          emotion: emotion ? String(emotion).trim() : 'neutral'
        };
      } else {
        const replyText = String(parsedObj).trim();
        if (!replyText) {
          throw new Error("Parsed content is empty");
        }
        return { reply: replyText, emotion: 'neutral' };
      }
    } catch (err) {
      // If JSON parsing or validation failed, check if it contains JSON characters
      // If it doesn't contain '{' or '[', treat it as a plain text response
      const hasJsonChars = aiContent.includes('{') || aiContent.includes('[');
      if (!hasJsonChars && aiContent.length > 0) {
        return { reply: aiContent, emotion: 'neutral' };
      }
      
      console.error(`[LLM Provider] JSON parse or validation failed:`, err.message);
      throw err;
    }
  }
}

module.exports = BaseLLMProvider;
