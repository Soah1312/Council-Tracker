import fs from 'fs';

const envPath = './.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.length > 0 && value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value.trim();
  }
});

const projectId = env.VITE_FIREBASE_PROJECT_ID;
const apiKey = env.VITE_FIREBASE_API_KEY;

const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/events?key=${apiKey}`;

function parseFirestoreFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [key, valObj] of Object.entries(fields)) {
    if ('stringValue' in valObj) obj[key] = valObj.stringValue;
    else if ('integerValue' in valObj) obj[key] = Number(valObj.integerValue);
    else if ('doubleValue' in valObj) obj[key] = Number(valObj.doubleValue);
    else if ('booleanValue' in valObj) obj[key] = valObj.booleanValue;
    else if ('timestampValue' in valObj) obj[key] = `Timestamp(${valObj.timestampValue})`;
    else if ('nullValue' in valObj) obj[key] = null;
    else if ('arrayValue' in valObj) {
      obj[key] = (valObj.arrayValue.values || []).map(v => {
        if ('stringValue' in v) return v.stringValue;
        if ('mapValue' in v) return parseFirestoreFields(v.mapValue.fields);
        return v;
      });
    } else if ('mapValue' in valObj) {
      obj[key] = parseFirestoreFields(valObj.mapValue.fields);
    } else {
      obj[key] = valObj;
    }
  }
  return obj;
}

async function fetchEvents() {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.error(`HTTP ${res.status} Error:`, text);
    process.exit(1);
  }
  const json = await res.json();
  const documents = json.documents || [];
  
  const report = [];

  documents.forEach((doc) => {
    const nameParts = doc.name.split('/');
    const docId = nameParts[nameParts.length - 1];
    const data = parseFirestoreFields(doc.fields);

    const keys = Object.keys(data).sort();
    
    // Check for any potential venue-related or location-related keys
    const venueKeys = keys.filter(k => 
      k.toLowerCase().includes('venue') || 
      k.toLowerCase().includes('location') || 
      k.toLowerCase().includes('room') || 
      k.toLowerCase().includes('place') || 
      k.toLowerCase().includes('hall') ||
      k.toLowerCase().includes('auditorium')
    );

    report.push({
      id: docId,
      eventName: data.eventName,
      councilName: data.councilName,
      status: data.status,
      venue: data.venue !== undefined ? data.venue : '<MISSING FIELD>',
      allDocKeys: keys,
      venueRelatedKeys: venueKeys.map(k => `${k}: ${JSON.stringify(data[k])}`),
      fullRawDoc: data
    });
  });

  fs.writeFileSync('./raw_events_analysis.json', JSON.stringify(report, null, 2));
  console.log(`Saved detailed raw analysis for ${report.length} documents to raw_events_analysis.json`);

  report.forEach(r => {
    console.log(`ID: ${r.id} | Name: ${r.eventName} | Council: ${r.councilName}`);
    console.log(`  -> venue field value: ${JSON.stringify(r.venue)}`);
    console.log(`  -> venue-related fields found: ${r.venueRelatedKeys.length > 0 ? r.venueRelatedKeys.join(', ') : 'None'}`);
    console.log(`  -> document keys count: ${r.allDocKeys.length}`);
    console.log('-'.repeat(50));
  });
}

fetchEvents().catch(err => {
  console.error('Error:', err);
});
