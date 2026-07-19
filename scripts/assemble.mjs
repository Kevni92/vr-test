import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const chunksDirectory = path.join(root, 'src', 'chunks');
const outputPath = path.join(root, 'src', 'main-v2.js');

const chunkNames = (await fs.readdir(chunksDirectory))
  .filter((name) => /^main-v2\.\d+\.b64$/.test(name))
  .sort();

if (chunkNames.length === 0) {
  throw new Error('Keine main-v2-Quellsegmente gefunden.');
}

const decodedChunks = [];
for (const name of chunkNames) {
  const encoded = (await fs.readFile(path.join(chunksDirectory, name), 'utf8')).trim();
  decodedChunks.push(Buffer.from(encoded, 'base64'));
}

await fs.writeFile(outputPath, Buffer.concat(decodedChunks));
console.log(`src/main-v2.js aus ${chunkNames.length} Segmenten erstellt.`);
