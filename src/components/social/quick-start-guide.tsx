
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { Compass, Wand2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface QuickStartGuideProps {
    onFinish: () => void;
}

export default function QuickStartGuide({ onFinish }: QuickStartGuideProps) {
    const [api, setApi] = useState<CarouselApi>();
    const [current, setCurrent] = useState(0);

    React.useEffect(() => {
        if (!api) return;
        setCurrent(api.selectedScrollSnap() + 1);
        api.on("select", () => {
            setCurrent(api.selectedScrollSnap() + 1);
        });
    }, [api]);

    return (
        <Dialog open={true} onOpenChange={(open) => { if (!open) onFinish(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Quick Start Guide</DialogTitle>
                    <DialogDescription>
                        Welcome to Lonkind! Here are a couple of tips to get started.
                    </DialogDescription>
                </DialogHeader>

                <Carousel setApi={setApi} className="w-full">
                    <CarouselContent>
                        <CarouselItem>
                            <Card className="bg-secondary/50">
                                <CardContent className="flex flex-col aspect-square items-center justify-center p-6 text-center">
                                    <Compass className="w-16 h-16 text-primary mb-4" />
                                    <h3 className="text-xl font-semibold">1. Explore & Connect</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Head to the "Explore" page to discover posts from everyone, or check out "Groups" to find your community. Follow people to see their posts on your home feed.
                                    </p>
                                </CardContent>
                            </Card>
                        </CarouselItem>
                         <CarouselItem>
                            <Card className="bg-secondary/50">
                                <CardContent className="flex flex-col aspect-square items-center justify-center p-6 text-center">
                                    <Wand2 className="w-16 h-16 text-primary mb-4" />
                                    <h3 className="text-xl font-semibold">2. Create with AI</h3>
                                    <p className="text-muted-foreground mt-2">
                                        Use the "AI Command Center" to generate ideas, write stories, create images, and even direct your own short videos. Bring your imagination to life!
                                    </p>
                                </CardContent>
                            </Card>
                        </CarouselItem>
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                </Carousel>
                <div className="py-2 text-center text-sm text-muted-foreground">
                    Slide {current} of 2
                </div>

                <DialogFooter>
                    <Button onClick={onFinish} className="w-full">Let's Go!</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
