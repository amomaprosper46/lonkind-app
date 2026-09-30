const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');
const callRule = `\n    /* ---------------- CALLS ---------------- */\n    match /calls/{callId} {\n      allow read, create, update, delete: if isSignedIn();\n    }\n`;
if (!rules.includes('/calls/')) {
    rules = rules.replace('  }\n}', callRule + '  }\n}');
    fs.writeFileSync('firestore.rules', rules);
    console.log('Added calls rule');
}
