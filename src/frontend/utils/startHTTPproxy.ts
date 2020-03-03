import express from 'express';
import { createLogger } from '../../utils/createLogger';

const logger = createLogger('frontend:http:')
export function startHTTPProxy(port: number, handleWellKnown: (host: string, path: string) => Promise<Buffer>) {
    let app = express();

    // Handle well-known separately
    app.get('/.well-known/*', function (req, res) {
        let subpath = req.path.substring('/.well-known'.length);
        (async () => {
            try {
                let result = await handleWellKnown(req.hostname, subpath);
                res.send(result);
            } catch (e) {
                logger.warn(e);
                if (!res.headersSent) {
                    res.status(404);
                    res.send('Not found');
                }
            }
        })();
    });

    // Redirect all to HTTPS
    app.get('*', function (req, res) {
        res.redirect('https://' + req.headers.host + req.url);
    });

    // Start Server
    app.listen(port, () => {
        logger.info('Started HTTP proxy on port: ' + port);
    });
}