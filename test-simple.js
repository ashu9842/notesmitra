import https from 'https';

setTimeout(() => {
  const data = JSON.stringify({
    text: 'Photosynthesis. Light reactions. Calvin cycle. Chlorophyll. ATP. NADPH. Glucose. C3 C4 CAM. Photorespiration.',
    title: 'Bio',
    subject: 'Biology'
  });
  
  const opts = {
    hostname: 'notesmitra.onrender.com',
    path: '/api/diagnostic/test-summary-pipeline',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  };
  
  https.request(opts, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        console.log('Topics:', json.result.keyTopicsCount, '| Points:', json.result.quickRevisionCount);
      } catch (e) {
        console.log('Error');
      }
      process.exit(0);
    });
  }).end(data);
}, 2000);
