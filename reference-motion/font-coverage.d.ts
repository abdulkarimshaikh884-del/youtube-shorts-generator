export type ReferenceFont = 'noto-sans' | 'latin-modern-roman';
export function supportedText(content: string, font: ReferenceFont): boolean;
export function fontForText(content: string, preferred: ReferenceFont): ReferenceFont | null;
