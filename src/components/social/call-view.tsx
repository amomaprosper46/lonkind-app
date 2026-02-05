
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

interface UserProfile {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
}

interface CallViewProps {
    callTargetUser: UserProfile;
    callType: 'audio' | 'video';
    onEndCall: () => void;
}

export default function CallView({ callTargetUser, callType, onEndCall }: CallViewProps) {
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(callType === 'video');
    const [hasCameraPermission, setHasCameraPermission] = useState(true);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        const getMedia = async () => {
            if (!isCameraOn) {
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach(track => track.stop());
                }
                if(localVideoRef.current) localVideoRef.current.srcObject = null;
                localStreamRef.current = null;
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                localStreamRef.current = stream;
                setHasCameraPermission(true);

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error("Error accessing media devices.", error);
                setHasCameraPermission(false);
                setIsCameraOn(false);
                toast({
                  variant: 'destructive',
                  title: 'Camera Access Denied',
                  description: 'Please enable camera permissions in your browser settings to use video calls.',
                });
            }
        };

        getMedia();

        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [isCameraOn]);


    const toggleCamera = () => {
        setIsCameraOn(prev => !prev);
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
        }
    }

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
            <div className="relative w-full h-full">
                 <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-white text-shadow-lg">
                        <Avatar className="w-40 h-40 border-4 border-primary">
                            <AvatarImage src={callTargetUser.avatarUrl} alt={callTargetUser.name} />
                            <AvatarFallback>{callTargetUser.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <h2 className="text-4xl font-bold">{callTargetUser.name}</h2>
                        <p className="text-xl text-muted-foreground">Connecting...</p>
                    </div>
                </div>

                <Card className="absolute top-4 right-4 w-48 h-auto aspect-[3/4] bg-black border-2 border-primary overflow-hidden cursor-move">
                    <GripVertical className="absolute top-1/2 -left-2 -translate-y-1/2 h-8 w-4 text-white/50" />
                     {isCameraOn ? (
                         <video ref={localVideoRef} className="w-full h-full object-cover" autoPlay muted />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-background p-2 text-center">
                            <VideoOff className="h-10 w-10 text-muted-foreground" />
                             {!hasCameraPermission && (
                                <Alert variant="destructive" className="mt-2">
                                    <AlertTitle>No Camera</AlertTitle>
                                    <AlertDescription>Camera access was denied.</AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </Card>


                <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center">
                     <div className="flex items-center gap-4 bg-background/20 backdrop-blur-sm p-4 rounded-full">
                        <Button
                            size="lg"
                            variant={isMuted ? 'destructive' : 'secondary'}
                            className="rounded-full w-16 h-16"
                            onClick={toggleMute}
                        >
                            {isMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                        </Button>
                        <Button
                            size="lg"
                            variant={isCameraOn ? 'secondary' : 'destructive'}
                            className="rounded-full w-16 h-16"
                            onClick={toggleCamera}
                        >
                            {isCameraOn ? <Video className="h-7 w-7" /> : <VideoOff className="h-7 w-7" />}
                        </Button>
                         <Button
                            size="lg"
                            variant="destructive"
                            className="rounded-full w-20 h-16"
                            onClick={onEndCall}
                        >
                            <PhoneOff className="h-7 w-7" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
