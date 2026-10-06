export function splitCsvRecords(text: string): string[];
export function parseCsvLine(line: string, options?: { trim?: boolean }): string[];
export function parseCsvRecords(text: string, options?: { trim?: boolean }): string[][];
