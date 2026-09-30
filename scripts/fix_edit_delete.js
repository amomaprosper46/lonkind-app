const fs = require('fs');
let code = fs.readFileSync('src/components/social/messaging-view.tsx', 'utf8');

const handlers = `
    const handleEditMessage = (msg: any) => {
        if (msg.senderId !== user?.uid) return;
        setEditingMessageId(msg.id);
        setNewMessage(msg.text || '');
    };

    const handleDeleteMessageForMe = async (msgId: string) => {
        if (!selectedConversation) return;
        try {
            const msgRef = doc(db, 'conversations', selectedConversation.id, 'messages', msgId);
            await updateDoc(msgRef, {
                deletedFor: arrayUnion(user?.uid)
            });
        } catch(e) { console.error('Error deleting for me:', e); }
    };

    const handleDeleteMessageForAll = async (msgId: string) => {
        if (!selectedConversation) return;
        try {
            const msgRef = doc(db, 'conversations', selectedConversation.id, 'messages', msgId);
            await deleteDoc(msgRef);
        } catch(e) { console.error('Error deleting for all:', e); }
    };

`;

if (!code.includes('handleDeleteMessageForMe')) {
    code = code.replace('const handleSendMessage = async () => {', handlers + 'const handleSendMessage = async () => {');
}

const oldMenuRegex = /<MessageActionMenu[\s\S]*?\/>/;
const newMenu = `<MessageActionMenu
                      isOpen={actionMenuOpen}
                      isSender={selectedMessage?.senderId === user?.uid}
                      onClose={() => setActionMenuOpen(false)}
                      onCopy={() => {
                        if (selectedMessage) {
                          handleCopyMessage(selectedMessage.text!, selectedMessage.id);
                        }
                        setActionMenuOpen(false);
                      }}
                      onDeleteForMe={() => {
                        if (selectedMessage) {
                          handleDeleteMessageForMe(selectedMessage.id);
                        }
                        setActionMenuOpen(false);
                      }}
                      onDeleteForAll={() => {
                        if (selectedMessage) {
                          handleDeleteMessageForAll(selectedMessage.id);
                        }
                        setActionMenuOpen(false);
                      }}
                      onEdit={() => {
                        if (selectedMessage) {
                          handleEditMessage(selectedMessage);
                        }
                        setActionMenuOpen(false);
                      }}
                      onMore={() => {
                        // placeholder for future actions
                        setActionMenuOpen(false);
                      }}
                    />`;

code = code.replace(oldMenuRegex, newMenu);

fs.writeFileSync('src/components/social/messaging-view.tsx', code);
console.log('Fixed edit/delete rules');
