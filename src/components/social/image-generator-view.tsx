
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ImageIcon, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { generateImage, GenerateImageOutput } from '@/ai/flows/generate-image';

export default function ImageGeneratorView() {
    const [prompt, setPrompt] = useState('A cinematic shot of a an old car driving down a deserted road at sunset.');
    const [imageData, setImageData] = useState<GenerateImageOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateImage = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setImageData(null);
        try {
            const result = await generateImage({ prompt });
            setImageData(result);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not generate the image. The model might be busy.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = () => {
        if (!imageData?.imageUrl) return;
        const link = document.createElement('a');
        link.href = imageData.imageUrl;
        link.download = `lonkind_ai_image_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>AI Image Generator</CardTitle>
                <CardDescription>Create stunning visuals from a simple text description.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Textarea 
                    placeholder="Enter a detailed description of the image you want to create..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    disabled={isLoading}
                />
                <Button onClick={handleGenerateImage} disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ImageIcon className="mr-2 h-5 w-5" /> Generate Image</>}
                </Button>

                {isLoading && (
                    <div className="flex justify-center items-center py-8 border rounded-lg bg-muted">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/>
                            <p className="mt-2 text-muted-foreground">Generating image... this can take a moment.</p>
                        </div>
                    </div>
                )}

                {imageData?.imageUrl && (
                    <div className="pt-4 space-y-4">
                        <div className="relative border rounded-lg overflow-hidden aspect-video">
                             <img src={imageData.imageUrl} alt={prompt} className="w-full h-full object-contain" />
                        </div>
                        <Button onClick={handleDownload} variant="outline" className="w-full">
                            <Download className="mr-2 h-4 w-4" /> Download Image
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
