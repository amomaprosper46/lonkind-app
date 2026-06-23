'use client';

import React from 'react';
import { useDockedChat } from './docked-chat-context';
import DockedChatWindow from './docked-chat-window';

export default function DockedChatContainer() {
    const { activeChats } = useDockedChat();

    if (activeChats.length === 0) return null;

    return (
        <div className="fixed bottom-0 right-20 z-50 hidden md:flex items-end gap-3 pointer-events-none">
            {activeChats.map(chat => (
                <div key={chat.contactId} className="pointer-events-auto">
                    <DockedChatWindow chat={chat} />
                </div>
            ))}
        </div>
    );
}
