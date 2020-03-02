import express from 'express';

export function startHealthcheck(port: number) {
    let app = express();
    app.get('/healthz', (req, res) => res.send('/healthz'));
    app.listen(port);
}