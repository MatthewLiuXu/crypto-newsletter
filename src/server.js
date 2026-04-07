import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { generateBriefingFiles, outputDir } from './generator.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const latestOutputPath = path.join(outputDir, 'latest.html');

let generationPromise = null;

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

async function ensureLatestBriefing({ force = false } = {}) {
  if (generationPromise) return generationPromise;

  if (!force && await fileExists(latestOutputPath)) {
    return { latestOutputPath, generated: false };
  }

  generationPromise = generateBriefingFiles()
    .then(({ briefing, latestOutputPath: filePath }) => ({
      latestOutputPath: filePath,
      generated: true,
      briefing,
    }))
    .finally(() => {
      generationPromise = null;
    });

  return generationPromise;
}

async function serveHtml(res, filePath) {
  const html = await readFile(filePath, 'utf8');
  send(res, 200, html, 'text/html; charset=utf-8');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname === '/health') {
      send(res, 200, JSON.stringify({ ok: true }), 'application/json; charset=utf-8');
      return;
    }

    if (url.pathname === '/generate') {
      const { briefing, latestOutputPath: filePath } = await ensureLatestBriefing({ force: true });
      send(
        res,
        200,
        JSON.stringify({
          ok: true,
          issueNumber: briefing?.issueNumber,
          date: briefing?.date,
          latestOutputPath: filePath,
        }),
        'application/json; charset=utf-8'
      );
      return;
    }

    if (url.pathname === '/' || url.pathname === '/latest') {
      const { latestOutputPath: filePath } = await ensureLatestBriefing();
      await serveHtml(res, filePath);
      return;
    }

    if (url.pathname.startsWith('/briefings/')) {
      const requestedName = path.basename(url.pathname.replace('/briefings/', ''));
      if (!requestedName.endsWith('.html')) {
        send(res, 400, 'Invalid file name');
        return;
      }

      const filePath = path.join(outputDir, requestedName);
      if (!await fileExists(filePath)) {
        send(res, 404, 'Briefing not found');
        return;
      }

      await serveHtml(res, filePath);
      return;
    }

    send(res, 404, 'Not found');
  } catch (error) {
    send(
      res,
      500,
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      'application/json; charset=utf-8'
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
  ensureLatestBriefing().catch((err) => {
    console.error('Background generation failed:', err);
  });
});
