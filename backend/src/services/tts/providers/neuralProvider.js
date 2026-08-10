const BaseProvider = require('./baseProvider');
const neuralTtsController = require('../neural/neuralTtsController');

class NeuralProvider extends BaseProvider {
  constructor(providerId, controller = neuralTtsController) {
    super();
    this.providerId = providerId;
    this.controller = controller;
  }

  async synthesize(text, options = {}) {
    return this.controller.synthesize(this.providerId, text, options);
  }
}

module.exports = NeuralProvider;
