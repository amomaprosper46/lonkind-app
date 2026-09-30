const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');
const oldMessagesRule = /match \/messages\/\{messageId\} \{[\s\S]*?\n\s*\}\n\s*\}/;
const newMessagesRule = `match /messages/{messageId} {
        allow read: if isSignedIn() && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantUids;
        allow create: if isSignedIn() && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantUids;
        allow update: if isSignedIn() && (
          (resource.data.senderId == request.auth.uid && request.resource.data.diff(resource.data).affectedKeys().hasAny(['text', 'editedAt'])) ||
          (request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantUids && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedFor']))
        );
        allow delete: if isSignedIn() && resource.data.senderId == request.auth.uid;
      }
    }`;
rules = rules.replace(oldMessagesRule, newMessagesRule);
fs.writeFileSync('firestore.rules', rules);
console.log('Updated firestore.rules');

let nextConfig = fs.readFileSync('next.config.mjs', 'utf8');
nextConfig = nextConfig.replace(/import withPWAInit from '@ducanh2912\/next-pwa';[\s\S]*?const withPWA = withPWAInit\(\{[\s\S]*?\}\);/, '');
nextConfig = nextConfig.replace(/export default withPWA\(nextConfig\);/, 'export default nextConfig;');
fs.writeFileSync('next.config.mjs', nextConfig);
console.log('Removed next-pwa from next.config.mjs');
