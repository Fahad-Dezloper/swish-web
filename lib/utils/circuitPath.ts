import * as path from 'path';

export function getCircuitBasePath(): string {
  return path.join(
    process.cwd(),
    'node_modules',
    'privacycash',
    'circuit2',
    'transaction2'
  );
}

let cachedPath: string | null = null;

export function getCircuitBasePathCached(): string {
  if (!cachedPath) {
    cachedPath = getCircuitBasePath();
  }
  return cachedPath;
}
