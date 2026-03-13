import https from 'https';

setTimeout(async () => {
  const data = JSON.stringify({ 
    text: 'Photosynthesis is the process by which plants convert light energy into glucose and oxygen. In the light reactions, water is split in photosystem II releasing O2. Electrons pass through an electron transport chain. In the Calvin cycle, CO2 is fixed by RuBisCO into 3-phosphoglycerate, reduced to G3P, and regenerates RuBP. Chlorophyll absorbs photons at 700nm in photosystem I and 680nm in photosystem II.'
  });

  const opts = {
    hostname: 'notesmitra.onrender.com',
    path: '/api/diagnostic/test-summary',
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
        if (json.result) {
          console.log('\n✅ AI SUMMARY RESPONSE:\n');
          console.log('Quick Revision Points:', json.result.quickRevision.length);
          json.result.quickRevision.slice(0, 5).forEach((p, i) => console.log('  ' + (i+1) + '. ' + p.substring(0, 65)));
          console.log('\nKey Topics:', json.result.keyTopics.length);
          if (json.result.keyTopics.length > 0) {
            json.result.keyTopics.slice(0, 5).forEach((t, i) => console.log('  ' + (i+1) + '. ' + t));
          }
          console.log('\nSummary length:', json.result.summary.length, 'chars');
          console.log('Summary preview:', json.result.summary.substring(0, 100) + '...');
        } else {
          console.log('❌ Generation failed:', json);
        }
      } catch (e) {
        console.log('Parse error:', e.message);
      }
      process.exit(0);
    });
  });
  req.on('error', e => { console.log('Error:', e.message); process.exit(1); });
  req.write(data);
  req.end();
}, 40000);
