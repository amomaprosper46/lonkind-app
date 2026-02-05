'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, Upload, Download, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { remixImage, RemixImageOutput } from '@/ai/flows/remix-image';
import { PulseLoader } from 'react-spinners';
import { Label } from '@/components/ui/label';

function fileToDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function RemixImageView() {
    const [prompt, setPrompt] = useState('Make this a vibrant, colorful, anime-style drawing.');
    const [originalImage, setOriginalImage] = useState<{ file: File; dataUri: string } | null>(null);
    const [remixedData, setRemixedData] = useState<RemixImageOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast({ variant: 'destructive', title: 'Invalid File', description: 'Please upload an image file.' });
                return;
            }
            const dataUri = await fileToDataUri(file);
            setOriginalImage({ file, dataUri });
            setRemixedData(null); // Clear previous remix on new image
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim() || !originalImage) {
             toast({ variant: 'destructive', title: 'Missing Input', description: 'Please upload an image and provide a prompt.' });
            return;
        }
        setIsLoading(true);
        setRemixedData(null);
        try {
            const result = await remixImage({ 
                imageUrl: originalImage.dataUri, 
                prompt 
            });
            setRemixedData(result);
        } catch (error: any) {
            console.error(error);
            toast({ 
                variant: 'destructive', 
                title: 'Remix Failed', 
                description: `Could not remix the image. This is an experimental feature and may fail under high demand. Error: ${error.message}`
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = () => {
        if (!remixedData?.remixedImageUrl) return;
        const link = document.createElement('a');
        link.href = remixedData.remixedImageUrl;
        link.download = `lonkind_remix_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>AI Image Remixer</CardTitle>
                <CardDescription>Upload an image and use a text prompt to transform it into something new.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>1. Original Image</Label>
                        <div 
                            className="aspect-square w-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center text-muted-foreground p-4 cursor-pointer hover:bg-accent/50"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {originalImage ? (
                                <img src={originalImage.dataUri} alt="Original image preview" className="max-h-full max-w-full object-contain rounded-md" />
                            ) : (
                                <>
                                    <Upload className="h-8 w-8 mb-2" />
                                    <p className="font-semibold">Click to upload</p>
                                    <p className="text-xs">PNG, JPG, GIF</p>
                                </>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label>2. Remix Result</Label>
                        <div className="aspect-square w-full border rounded-lg bg-muted flex items-center justify-center">
                             {isLoading ? (
                                <div className="text-center p-4">
                                    <PulseLoader color="hsl(var(--primary))" loading={true} size={15} />
                                    <p className="mt-6 text-muted-foreground font-semibold">The AI is remixing your image...</p>
                                    <p className="text-sm text-muted-foreground">This can take a moment.</p>
                                </div>
                            ) : remixedData?.remixedImageUrl ? (
                                <img src={remixedData.remixedImageUrl} alt="Remixed image result" className="max-h-full max-w-full object-contain rounded-md" />
                            ) : (
                                <div className="text-center text-muted-foreground p-4">
                                    <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                                    <p>Your remixed image will appear here.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                 <div className="space-y-2">
                     <Label htmlFor="remix-prompt">3. Remix Prompt</Label>
                     <Textarea 
                        id="remix-prompt"
                        placeholder="e.g., Change the style to a watercolor painting"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={3}
                        disabled={isLoading}
                    />
                 </div>

                 <div className="flex gap-2">
                    <Button onClick={handleGenerate} disabled={isLoading || !originalImage} className="w-full">
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Wand2 className="mr-2 h-5 w-5" /> Remix Image</>}
                    </Button>
                     {remixedData && (
                        <Button onClick={handleDownload} variant="outline" className="w-full">
                            <Download className="mr-2 h-4 w-4" /> Download Remixed Image
                        </Button>
                    )}
                 </div>
            </CardContent>
        </Card>
    );
}
