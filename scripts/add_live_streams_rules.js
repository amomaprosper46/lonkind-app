const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');
const liveRule = `\n    /* ---------------- LIVE STREAMS ---------------- */\n    match /live_streams/{streamId} {\n      allow read, create, update, delete: if isSignedIn();\n      match /chat/{msgId} {\n        allow read, create: if isSignedIn();\n      }\n    }\n`;
if (!rules.includes('/live_streams/')) {
    rules = rules.replace('  }\n}', liveRule + '  }\n}');
    fs.writeFileSync('firestore.rules', rules);
    console.log('Added live_streams rule');
}
