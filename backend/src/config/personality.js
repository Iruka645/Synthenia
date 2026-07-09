// Personality Configuration here
require("dotenv").config();

const { buildSystemPrompt } = require("../prompts/system_builder");

const AI_MODEL = process.env.AI_MODEL;
const PERSONALITY = buildSystemPrompt();

const MODEL_CONFIG = {
  model: AI_MODEL,
  options: {
    temperature: 0.7,
    top_p: 0.9,
    num_predict: 150,
  },
};

module.exports = { PERSONALITY, MODEL_CONFIG };
