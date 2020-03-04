import express from 'express';
import { createLogger } from '../utils/createLogger';
import { newToken } from '../newToken';
import * as uuid from 'uuid';
const quotes = require('inspirational-quotes');
const logger = createLogger('registrator');

export function startRegistrator(port: number, baseHost: string) {
    let key = process.env.REG_KEY;
    if (!key) {
        logger.warn('No key provided!');
        process.exit(-1);
    }
    let app = express();

    app.get('/', function (req, res) {
        let q = quotes.getQuote();
        res.send('"' + q.text + '", ' + q.author);
    });

    app.post('/random', function (req, res) {
        let host = uuid.v4();
        while (host.indexOf('-') >= 0) {
            host = host.replace('-', '');
        }
        let token = newToken(key!, host + '.' + baseHost);
        res.send({ token, host: host + '.' + baseHost });
    });

    app.listen(port, () => {
        logger.info('Registrator started at port: ' + port);
    });
}