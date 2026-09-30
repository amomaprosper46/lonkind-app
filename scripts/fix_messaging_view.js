const fs = require('fs');
let code = fs.readFileSync('src/components/social/messaging-view.tsx', 'utf8');

// 1. Add conversationsRef
if (!code.includes('const conversationsRef = collection(db, \'conversations\');')) {
    code = code.replace(/export interface Conversation/, `const conversationsRef = collection(db, 'conversations');\n\nexport interface Conversation`);
}

// 2. Add deletedFor to Message interface
if (!code.includes('deletedFor?: string[]')) {
    code = code.replace(/timestamp: any;/, `timestamp: any;\n    deletedFor?: string[];`);
}

// 3. Add missing state hooks
const hooksToAdd = `
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
`;
if (!code.includes('const [isLoading, setIsLoading]')) {
    code = code.replace(/const \[actionMenuOpen, setActionMenuOpen\] = useState\(false\);/, 
    `const [actionMenuOpen, setActionMenuOpen] = useState(false);${hooksToAdd}`);
}

fs.writeFileSync('src/components/social/messaging-view.tsx', code);
console.log('Fixed missing states and variables');
