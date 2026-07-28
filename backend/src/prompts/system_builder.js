const fs = require("node:fs");
const path = require("node:path");
require('dotenv').config()

const EXAMPLE_ALLOW = process.env.EXAMPLE_ENABLE

const PROMPT_SECTION_ORDER = [
  "identity",
  "personality",
  "speech_style",
  "emotion_input",
  "json_schema",
  "memory_context",
];

if(EXAMPLE_ALLOW === "true") {
  PROMPT_SECTION_ORDER.push("examples");
}

const PROMPTS_DIR = __dirname;

let promptSectionsCache = null;

function readPromptSection(sectionName) {
  if (promptSectionsCache && promptSectionsCache[sectionName]) {
    return promptSectionsCache[sectionName];
  }

  const filePath = path.join(PROMPTS_DIR, `${sectionName}.md`);
  const content = fs.readFileSync(filePath, "utf8").trim();

  if (!promptSectionsCache) {
    promptSectionsCache = {};
  }
  promptSectionsCache[sectionName] = content;
  return content;
}

function buildSystemPrompt({ memoryContext = "" } = {}) {
  const sections = PROMPT_SECTION_ORDER.map(readPromptSection);
  const normalizedMemoryContext = String(memoryContext || "").trim();

  if (normalizedMemoryContext) {
    const memoryIndex = PROMPT_SECTION_ORDER.indexOf("memory_context");
    sections[memoryIndex] = `${sections[memoryIndex]}\n\n${normalizedMemoryContext}`;
  }

  return sections.join("\n\n---\n\n").trim();
}

function buildMemoryContext({
  reflectiveSummary = "",
  facts = [],
  usedFallback = false,
  fallbackMessages = [],
} = {}) {
  const sections = [];
  const summary = String(reflectiveSummary || "").trim();

  if (summary) {
    sections.push(`[ภาพรวมความสัมพันธ์ของคุณกับ Ken]:\n${summary}`);
  }

  if (Array.isArray(facts) && facts.length > 0) {
    const factLines = facts
      .map((fact) => fact && fact.fact_text)
      .filter(Boolean)
      .map((factText) => `- ${factText}`)
      .join("\n");

    if (factLines) {
      sections.push(`[ข้อมูลความจำระยะยาวที่เกี่ยวข้อง]:\n${factLines}`);
    }
  }

  if (usedFallback && Array.isArray(fallbackMessages) && fallbackMessages.length > 0) {
    const messageLines = fallbackMessages
      .filter((message) => message && message.content)
      .map((message) => {
        const speaker = message.role === "user" ? "Ken" : "Syn";
        return `- ${speaker}: ${message.content}`;
      })
      .join("\n");

    if (messageLines) {
      sections.push(`[บันทึกข้อความในอดีตที่เกี่ยวข้อง]:\n${messageLines}`);
    }
  }

  return sections.join("\n\n").trim();
}

module.exports = {
  PROMPT_SECTION_ORDER,
  buildMemoryContext,
  buildSystemPrompt,
};
