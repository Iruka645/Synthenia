class BaseProvider {
  async synthesize(text) {
    throw new Error("Method 'synthesize(text)' must be implemented.");
  }
}

module.exports = BaseProvider;
