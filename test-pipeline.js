import https from 'https';

setTimeout(async () => {
  const data = JSON.stringify({
    text: 'Photosynthesis is the process by which plants convert light energy into chemical energy. The light-dependent reactions occur in the thylakoid membrane where photons excite electrons. The electron transport chain pumps protons across the membrane. Photosystem II contains a oxygen-evolving complex that splits water molecules. The resulting ATP and NADPH are used in the Calvin cycle to fix CO2 into GLyceraldehydes-3-phosphate which is used to regenerate RuBP and synthesize glucose. C3 plants are more efficient than C4 plants in high CO2 environments. Photorespiration occurs when Rubisco carboxylates RuBP with O2 instead of CO2. CAM plants have modified  stomata that open at night to minimize water loss. Accessory pigments like carotenoids and chlorophyll b extend the light spectrum captured.',
    title: 'Photosynthesis Notes',
    subject: 'Biology'
  });
  
  const opts = {
    hostname: 'notesmitra.onrender.com',
    path: '/api/diagnostic/test-summary-pipeline',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  
  const req = https.request(opts, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        console.log('\n📊 DIAGNOSTIC PIPELINE RESULTS:\n');
        console.log('Timestamp:', json.timestamp);
        console.log('\nSteps:');
        json.steps.forEach(step => {
          const statusEmoji = step.status === 'OK' ? '✅' : '❌';
          console.log(`${statusEmoji} ${step.step}`);
          if (step.error) console.log(`   Error: ${step.error}`);
          if (step.apiKeyExists !== undefined) console.log(`   API Key: ${step.apiKeyExists ? 'SET (' + step.apiKeyLength + ' chars)' : 'NOT SET'}`);
          if (step.responseLength !== undefined) console.log(`   Response: ${step.responseLength} chars`);
        });
        
        if (json.result) {
          console.log('\n✅ SUCCESS!');
          console.log('Summary:', json.result.summary);
          console.log('Key Topics:', json.result.keyTopicsCount);
          console.log('Quick Revision Points:', json.result.quickRevisionCount);
        } else if (json.error) {
          console.log('\n❌ ERROR:', json.error);
        }
      } catch (e) {
        console.log('Parse error:', e.message);
        console.log('Response:', body.substring(0, 300));
      }
      process.exit(0);
    });
  });
  
  req.on('error', e => { 
    console.log('Request error:', e.message); 
    process.exit(1); 
  });
  req.write(data);
  req.end();
}, 50000);
