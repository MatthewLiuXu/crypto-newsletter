import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { aggregateBriefing } from './aggregator.js';
import { renderBriefing } from './renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output');

async function main() {
  const briefing = await aggregateBriefing();
  const html = renderBriefing(briefing);
  const outputPath = path.join(outputDir, `briefing-${briefing.date}.html`);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, html, 'utf8');

  console.log(`Generated ${outputPath}`);
  console.log(`Date: ${briefing.displayDate} · Issue #${briefing.issueNumber}`);
  console.log(`Prices: ${briefing.market.prices.length}`);
  console.log(`Headlines: ${briefing.headlines.length}`);
  console.log(`On-chain cards: ${briefing.onChain.length}`);
  console.log(`Predictions: ${briefing.predictions.length}`);
  console.log(`KOLs: ${briefing.kols.length}`);
  console.log(`Deep reads: ${briefing.deepReads.length}`);

  if (briefing.meta.failures.length > 0) {
    console.log('Failures:');
    briefing.meta.failures.forEach((failure) => {
      console.log(`- ${failure.source}: ${failure.error}`);
    });
  } else {
    console.log('Failures: none');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
