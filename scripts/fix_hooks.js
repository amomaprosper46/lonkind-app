const fs = require('fs');
let code = fs.readFileSync('src/components/social/messaging-view.tsx', 'utf8');

const bubbleCode = `
function MessageBubble({ msg, user, setSelectedMessage, setActionMenuOpen, handleCopyMessage, copiedMessageId }: any) {
  const isOwn = msg.senderId === user?.uid;
  const longPressHandlers = useLongPress(() => {
    setSelectedMessage(msg);
    setActionMenuOpen(true);
  }, 3000);

  return (
    <div className={\`group flex items-end gap-2 \${isOwn ? 'justify-end' : 'justify-start'}\`} {...longPressHandlers}>
      {msg.senderId !== user?.uid && msg.type === 'text' && (
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopyMessage(msg.text, msg.id)}>
          {copiedMessageId === msg.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
      <div className={cn(
        \`max-w-xs lg:max-w-md p-3 rounded-xl \${isOwn ? 'bg-primary text-primary-foreground' : 'bg-background shadow-sm'} \${msg.type === 'audio' ? 'p-2' : ''}\`
      )}>
        {msg.type === 'text' ? (
          <p>{msg.text}</p>
        ) : (
          <audio controls src={msg.audioUrl} className="h-10" />
        )}
        {msg.timestamp && (
          <p className={\`text-xs mt-1 text-right \${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}\`}>
            {new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {'editedAt' in msg && (
          <p className="text-xs text-muted-foreground italic">(edited)</p>
        )}
      </div>
      {isOwn && msg.type === 'text' && (
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopyMessage(msg.text, msg.id)}>
          {copiedMessageId === msg.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}
`;

code = code.replace('export default function MessagingView', bubbleCode + '\nexport default function MessagingView');

const mapRegex = /\.map\(msg => \{[\s\S]*?return \([\s\S]*?<div[\s\S]*?key=\{msg\.id\}[\s\S]*?className=\{.*?group flex items-end[\s\S]*?<\/div>\s*\);\s*\}\)/;

const newMapStr = `.map(msg => {
                        return (
                          <MessageBubble
                            key={msg.id}
                            msg={msg}
                            user={user}
                            setSelectedMessage={setSelectedMessage}
                            setActionMenuOpen={setActionMenuOpen}
                            handleCopyMessage={handleCopyMessage}
                            copiedMessageId={copiedMessageId}
                          />
                        );
                      })`;

code = code.replace(mapRegex, newMapStr);

fs.writeFileSync('src/components/social/messaging-view.tsx', code);
console.log('Fixed hooks map error');
