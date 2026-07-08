class BaseLLMProvider {
  /**
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options - { model, temperature, top_p, num_predict }
   * @returns {Promise<{reply: string, emotion: string}>}
   */
  async chat(messages, options = {}) {
    throw new Error("Method 'chat(messages, options)' must be implemented.");
  }
}

module.exports = BaseLLMProvider;
