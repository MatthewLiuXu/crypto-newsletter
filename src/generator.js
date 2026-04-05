import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { aggregateBriefing } from './aggregator.js';
import { renderBriefing } from './renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
export const outputDir = path.join(projectRoot, 'output');

export async function generateBriefingFiles({ now = new Date() } = {}) {
  const briefing = await aggregateBriefing({ now });
  const html = renderBriefing(briefing);
  const datedOutputPath = path.join(outputDir, `briefing-${briefing.date}.html`);
  const latestOutputPath = path.join(outputDir, 'latest.html');

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(datedOutputPath, html, 'utf8'),
    writeFile(latestOutputPath, html, 'utf8'),
  ]);

  return {
    briefing,
    html,
    datedOutputPath,
    latestOutputPath,
  };
}
