import https from 'https';

setTimeout(async () => {
  const data = JSON.stringify({
    text: 'Photosynthesis is the process by which plants convert light energy into chemical energy. The light-dependent reactions occur in the thylakoid membrane where photons excite electrons. The electron transport chain pumps protons across the membrane. Photosystem II contains an oxygen-evolving complex that splits water molecules. The resulting ATP and NADPH are used in the Calvin cycle to fix CO2 into glyceraldehyde-3-phosphate which is used to regenerate RuBP and synthesize glucose. C3 plants are more efficient than C4 plants in high CO2 environments. Photorespiration occurs when Rubisco carboxylates RuBP with O2 instead of CO2. CAM plants have modified stomata that open at night to minimize water loss. Accessory pigments like carotenoids and chlorophyll b extend the light spectrum captured.',
    title: 'Photosynthesis',
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
        console.log('\n✅ IMPROVED PROMPT RESULTS:');
        console.log('📊 Topics:', json.result.keyTopicsCount);
        console.log('📝 Revision Points:', json.result.quickRevisionCount);
        console.log('📄 Summary:', json.result.summary.substring(0, 80) + '...\n');
      } catch (e) {
        console.log('Parse error:', e.message);
      }
      process.exit(0);
    });
  });
  
  req.on('error', e => { 
    console.log('Error:', e.message); 
    process.exit(1); 
  });
  req.write(data);
  req.end();
}, 38000);
