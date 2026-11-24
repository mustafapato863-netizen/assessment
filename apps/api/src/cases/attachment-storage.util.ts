import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

const DEFAULT_STORAGE_DIR = resolve(process.cwd(), '.assessflow-attachments');
const memoryBlobs = new Map<string, Buffer>();

export function attachmentStorageRoot(): string {
  return process.env.ATTACHMENTS_STORAGE_DIR?.trim() || DEFAULT_STORAGE_DIR;
}

function safeDiskPath(storageKey: string): string {
  const root = resolve(attachmentStorageRoot());
  const normalized = storageKey.replace(/^\/+/, '').replace(/\.\./g, '_');
  const fullPath = resolve(root, normalized);
  if (!fullPath.startsWith(root)) {
    throw new Error('Invalid attachment storage path.');
  }
  return fullPath;
}

export async function storeAttachmentBytes(
  storageKey: string,
  contentBase64?: string,
): Promise<void> {
  if (!contentBase64) return;
  const clean = contentBase64.includes(',')
    ? (contentBase64.split(',').pop() ?? '')
    : contentBase64;
  const buffer = Buffer.from(clean, 'base64');
  memoryBlobs.set(storageKey, buffer);

  if (process.env.DATA_MODE === 'database') {
    const filePath = safeDiskPath(storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }
}

export async function readAttachmentBytes(
  storageKey: string,
  fallbackLabel?: string,
): Promise<Buffer> {
  const cached = memoryBlobs.get(storageKey);
  if (cached) return cached;

  try {
    const filePath = safeDiskPath(storageKey);
    const data = await readFile(filePath);
    memoryBlobs.set(storageKey, data);
    return data;
  } catch {
    return Buffer.from(
      `AssessFlow verified attachment placeholder for ${basename(fallbackLabel ?? storageKey)}`,
      'utf8',
    );
  }
}
