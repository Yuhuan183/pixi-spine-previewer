import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

import type { Plugin } from 'vite';

import { scanDirectory } from './fsScan';

/**
 * Dev-only filesystem endpoints used by src/dev/devHost.ts.
 *
 * Serving them from the dev server is what lets the browser build stand in for the desktop
 * host while iterating (`?devfs=<absolute path>`); the plugin only applies to `vite serve`
 * and never reaches a production build. It enforces the same rule as the Rust host: reads
 * are limited to directories scanned in this server session, compared after `realpath`.
 */
export function devFsPlugin(): Plugin {
  const allowed = new Set<string>();
  const isInside = (root: string, target: string) => {
    const rel = path.relative(root, target);

    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  };

  return {
    name: 'dev-fs',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev-fs/scan', (req, res) => {
        const requested = new URL(req.url ?? '', 'http://localhost').searchParams.get('root');

        if (!requested) {
          res.statusCode = 400;
          res.end('missing root');

          return;
        }

        void realpath(requested)
          .then(async (root) => {
            allowed.add(root);

            const result = await scanDirectory(root);

            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(result));
          })
          .catch((error: Error) => {
            res.statusCode = 500;
            res.end(error.message);
          });
      });

      server.middlewares.use('/__dev-fs/file', (req, res) => {
        const requested = new URL(req.url ?? '', 'http://localhost').searchParams.get('path');

        if (!requested) {
          res.statusCode = 400;
          res.end('missing path');

          return;
        }

        void realpath(requested)
          .then(async (target) => {
            if (![...allowed].some((root) => isInside(root, target))) {
              res.statusCode = 403;
              res.end('outside the scanned root');

              return;
            }

            res.setHeader('content-type', 'application/octet-stream');
            res.end(await readFile(target));
          })
          .catch((error: Error) => {
            res.statusCode = 404;
            res.end(error.message);
          });
      });
    },
  };
}
