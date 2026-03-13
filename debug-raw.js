import https from 'https';

setTimeout(async () => {
  const data = JSON.stringify({
    text: 'Photosynthesis is light-dependent. Water splits. CO2 fixed. Glucose made. Accessory pigments. C3 C4 CAM plants. Photorespiration. Stomata regulation.'
  });
  
  const opts = {
    hostname: 'notesmitra.onrender.com',
    path: '/api/diagnostic/test-raw-groq',
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
        console.log('\n📍 RAW GROQ RESPONSE:\n');
        console.log(json.rawResponse);
        console.log('\n');
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
}, 3000);
