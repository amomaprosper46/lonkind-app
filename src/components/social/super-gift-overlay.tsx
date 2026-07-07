'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap } from 'lucide-react';

interface SuperGiftDetail {
    id: string;
    emoji: string;
    label: string;
    coins: number;
    senderName: string;
    recipientName: string;
}

export default function SuperGiftOverlay() {
    const [currentGift, setCurrentGift] = useState<SuperGiftDetail | null>(null);

    useEffect(() => {
        const handleSuperGift = (event: Event) => {
            const customEvent = event as CustomEvent<SuperGiftDetail>;
            if (customEvent.detail && customEvent.detail.coins >= 100) {
                setCurrentGift({
                    ...customEvent.detail,
                    id: Math.random().toString(),
                });

                // Auto dismiss after 4.5 seconds
                setTimeout(() => {
                    setCurrentGift(prev => (prev?.id === customEvent.detail.id ? null : prev));
                }, 4500);
            }
        };

        window.addEventListener('super-gift', handleSuperGift);
        return () => window.removeEventListener('super-gift', handleSuperGift);
    }, []);

    // Also allow dismissing by clicking
    const handleDismiss = () => setCurrentGift(null);

    return (
        <AnimatePresence>
            {currentGift && (
                <motion.div
                    key={currentGift.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleDismiss}
                    className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer overflow-hidden"
                >
                    {/* Background celebratory light rays */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                            className="w-[800px] h-[800px] bg-gradient-radial from-amber-500/20 via-pink-500/10 to-transparent rounded-full blur-3xl"
                        />
                    </div>

                    {/* Floating particle emojis */}
                    {[...Array(12)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{
                                x: 0,
                                y: 0,
                                scale: 0.5,
                                opacity: 0,
                            }}
                            animate={{
                                x: (Math.random() - 0.5) * 600,
                                y: (Math.random() - 0.5) * 600,
                                scale: [0.5, 1.8, 1],
                                opacity: [0, 1, 0],
                            }}
                            transition={{
                                duration: 2.5 + Math.random(),
                                repeat: Infinity,
                                delay: Math.random() * 0.5,
                            }}
                            className="absolute text-4xl pointer-events-none select-none"
                        >
                            {i % 3 === 0 ? currentGift.emoji : i % 3 === 1 ? '✨' : '💎'}
                        </motion.div>
                    ))}

                    {/* Main Banner */}
                    <motion.div
                        initial={{ scale: 0.3, y: 100, rotate: -5 }}
                        animate={{ scale: 1, y: 0, rotate: 0 }}
                        exit={{ scale: 0.5, y: -100, opacity: 0 }}
                        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                        className="relative z-10 max-w-lg w-full mx-4 p-8 rounded-3xl bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 p-[3px] shadow-[0_0_80px_rgba(245,158,11,0.6)] transform"
                    >
                        <div className="bg-slate-950/95 backdrop-blur-xl rounded-[22px] p-6 text-center text-white relative overflow-hidden border border-white/10">
                            {/* Glowing top icon */}
                            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/50 mb-4 border-2 border-white/30 animate-bounce">
                                <span className="text-4xl">{currentGift.emoji}</span>
                            </div>

                            <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-400 font-extrabold text-xs uppercase tracking-widest mb-3 shadow-inner"
                            >
                                <Zap className="h-3.5 w-3.5 fill-amber-400" /> Super Gift Unlocked! <Sparkles className="h-3.5 w-3.5" />
                            </motion.div>

                            <h3 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 mb-2">
                                {currentGift.label} ({currentGift.coins.toLocaleString()} Coins)
                            </h3>

                            <p className="text-sm text-slate-300">
                                <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded-md">{currentGift.senderName}</span>
                                {' '}just sent a legendary gift to{' '}
                                <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">@{currentGift.recipientName}</span>!
                            </p>

                            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
                                <span>Click anywhere to continue</span>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
