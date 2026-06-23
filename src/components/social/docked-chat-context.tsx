'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface DockedChat {
    contactId: string;
    contactName: string;
    contactAvatar: string;
    isMinimized: boolean;
}

interface DockedChatContextType {
    activeChats: DockedChat[];
    openChat: (contact: { id: string; name: string; avatar: string }) => void;
    closeChat: (contactId: string) => void;
    toggleMinimize: (contactId: string) => void;
}

const DockedChatContext = createContext<DockedChatContextType | undefined>(undefined);

export function DockedChatProvider({ children }: { children: ReactNode }) {
    const [activeChats, setActiveChats] = useState<DockedChat[]>([]);
    const MAX_CHATS = 3;

    const openChat = (contact: { id: string; name: string; avatar: string }) => {
        setActiveChats(prev => {
            // If already open, just make sure it's not minimized
            if (prev.find(c => c.contactId === contact.id)) {
                return prev.map(c => c.contactId === contact.id ? { ...c, isMinimized: false } : c);
            }
            
            // Add new chat, remove oldest if we hit the limit
            const newChat: DockedChat = { 
                contactId: contact.id, 
                contactName: contact.name, 
                contactAvatar: contact.avatar, 
                isMinimized: false 
            };
            
            const updated = [...prev, newChat];
            if (updated.length > MAX_CHATS) {
                updated.shift(); // Remove the oldest chat
            }
            return updated;
        });
    };

    const closeChat = (contactId: string) => {
        setActiveChats(prev => prev.filter(c => c.contactId !== contactId));
    };

    const toggleMinimize = (contactId: string) => {
        setActiveChats(prev => prev.map(c => 
            c.contactId === contactId ? { ...c, isMinimized: !c.isMinimized } : c
        ));
    };

    return (
        <DockedChatContext.Provider value={{ activeChats, openChat, closeChat, toggleMinimize }}>
            {children}
        </DockedChatContext.Provider>
    );
}

export function useDockedChat() {
    const context = useContext(DockedChatContext);
    if (context === undefined) {
        throw new Error('useDockedChat must be used within a DockedChatProvider');
    }
    return context;
}
