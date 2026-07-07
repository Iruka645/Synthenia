// backend/test/test_rvc.js
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const voiceConversionService = require('../src/services/voiceConversionService');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log("=== RVC Server Transition Test ===");
  
  // 1. Start RVC server
  console.log("1. Starting RVC Server...");
  voiceConversionService.startServer();
  
  // 2. Poll health endpoint until it is loaded
  const healthUrl = `${voiceConversionService.serverUrl}/health`;
  console.log(`2. Waiting for RVC Server to load model at ${healthUrl}...`);
  
  let isLoaded = false;
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds max wait
  
  while (attempts < maxAttempts) {
    try {
      const res = await axios.get(healthUrl);
      if (res.data && res.data.model_loaded) {
        console.log("RVC Server is ready!");
        isLoaded = true;
        break;
      } else {
        console.log(`Model is loading... attempts: ${attempts + 1}`);
      }
    } catch (err) {
      console.log(`Server not listening yet... attempts: ${attempts + 1}`);
    }
    await wait(1000);
    attempts++;
  }
  
  if (!isLoaded) {
    console.error("FAILED: RVC Server did not become ready in time.");
    voiceConversionService.stopServer();
    process.exit(1);
  }
  
  // 3. Perform voice conversion
  console.log("3. Converting test_input.wav...");
  const startTime = Date.now();
  try {
    const outputFilename = await voiceConversionService.convert('test_input.wav', 0, 0.45);
    const duration = (Date.now() - startTime) / 1000;
    console.log(`SUCCESS: Voice conversion completed in ${duration} seconds.`);
    console.log(`Generated file: ${outputFilename}`);
    
    // Verify file exists
    const outputPath = path.join(voiceConversionService.audioDir, outputFilename);
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      console.log("SUCCESS: Output file exists and is not empty.");
    } else {
      console.error("FAILED: Output file does not exist or is empty.");
    }
  } catch (error) {
    console.error("FAILED: Conversion error:", error.message);
  }
  
  // 4. Test concurrency (queue / lock)
  console.log("4. Testing concurrency (sending 2 requests in parallel)...");
  try {
    const p1 = voiceConversionService.convert('test_input.wav', 0, 0.45);
    const p2 = voiceConversionService.convert('test_input.wav', 0, 0.45);
    
    const [file1, file2] = await Promise.all([p1, p2]);
    console.log(`SUCCESS: Parallel requests processed successfully.`);
    console.log(`File 1: ${file1}`);
    console.log(`File 2: ${file2}`);
  } catch (error) {
    console.error("FAILED: Parallel conversion error:", error.message);
  }

  // 5. Stop RVC server
  console.log("5. Stopping RVC Server...");
  voiceConversionService.stopServer();
  console.log("=== Test Finished ===");
  process.exit(0);
}

runTest().catch(err => {
  console.error("Unexpected test error:", err);
  voiceConversionService.stopServer();
  process.exit(1);
});
