// Type declarations for modules missing @types packages

declare module 'ngeohash' {
  export function encode(latitude: number, longitude: number, precision?: number): string;
  export function decode(hash: string): { latitude: number; longitude: number };
  export function decode_bbox(hash: string): [number, number, number, number];
  export function bboxes(minlat: number, minlon: number, maxlat: number, maxlon: number, precision?: number): string[];
  export function neighbor(hash: string, direction: [number, number]): string;
  export function neighbors(hash: string): string[];
}

declare module 'node-fetch' {
  const fetch: typeof globalThis.fetch;
  export default fetch;
  export * from 'node-fetch';
}

declare module 'genkit/media' {
  export function toBase64(media: unknown): string;
  export function fromBase64(data: string, contentType: string): unknown;
  export const media: {
    url?: string;
    contentType?: string;
    b64?: string;
  } | null;
}
