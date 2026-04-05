import 'dotenv/config';
import { generateBriefingFiles } from './generator.js';

async function main() {
  const { briefing, datedOutputPath, latestOutputPath } = await generateBriefingFiles();

  console.log(`Generated ${datedOutputPath}`);
  console.log(`Updated ${latestOutputPath}`);
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
