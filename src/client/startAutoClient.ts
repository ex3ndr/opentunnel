import fs from 'fs';
import path from 'path';
import tls from 'tls';
import net from 'net';
import acme from 'acme-client';
import { ClientTunnel } from './ClientTunnel';
import { createLogger } from "../utils/createLogger";
import { backoff } from '../utils/timer';
import { registerRandomDomain } from '../registrator/registerRandomDomain';

const logger = createLogger('client');

export async function startAutoClient(port: number) {

    // Resolve config
    let workDir = path.resolve('.opentunnel');
    let configPath = path.resolve(workDir, 'config.json');
    let host: string | null = null;
    let key: Buffer | null = null;
    if (fs.existsSync(configPath)) {
        let cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (typeof cfg.host === 'string' && typeof cfg.key === 'string') {
            host = cfg.host;
            key = Buffer.from(cfg.key, 'base64');
        }
    }

    // Load host and key
    if (!host || !key) {
        logger.info('Generating hostname');
        let reg = await backoff(() => registerRandomDomain());
        key = Buffer.from(reg.token, 'base64');
        host = reg.host as string;
        logger.info('Got hostname: ' + host);
        if (!fs.existsSync('.opentunnel')) {
            fs.mkdirSync('.opentunnel');
        }
        fs.writeFileSync(configPath, JSON.stringify({ host, key: reg.token }), 'utf-8');
    }

    //
    // Certificate Management
    //

    let acmeKeys = new Map<string, string>();
    async function fetchNewCertificates() {
        const client = new acme.Client({
            directoryUrl: acme.directory.letsencrypt.production,
            accountKey: await acme.forge.createPrivateKey(),
        });

        const [key, csr] = await acme.forge.createCsr({
            commonName: host!,
        });

        const cert = await client.auto({
            csr,
            termsOfServiceAgreed: true,
            skipChallengeVerification: true,
            challengePriority: ['http-01'],
            challengeCreateFn: async (authz, challenge, keyAuthorization) => {
                logger.info('Challenge: ' + challenge.token);
                acmeKeys.set(challenge.token, keyAuthorization);
            },
            challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
                acmeKeys.delete(challenge.token);
            },
        });

        // Private key
        fs.writeFileSync(path.resolve(workDir, 'privatekey.pem'), key);

        // Certificate
        const chain = cert
            .trim()
            .split(/[\r\n]{2,}/g)
            .map((s) => `${s}\n`);
        fs.writeFileSync(path.resolve(workDir, 'certificate.pem'), chain[0]);
        fs.writeFileSync(path.resolve(workDir, 'chain.pem'), chain.join('\n'));
    }

    async function checkForRenew() {
        const info = await acme.forge.readCertificateInfo(fs.readFileSync(path.resolve(workDir, 'certificate.pem')));

        let expire = new Date(info.notAfter).getTime();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() + oneWeek <= expire) {
            logger.info('No need to renew certificate');
            setTimeout(checkForRenew, 60 * 60 * 1000); // Check again in an hour
            return;
        }

        logger.info('Renewing certificate....');
        await fetchNewCertificates();
        logger.info('Renewal successful');
        setTimeout(checkForRenew, 60 * 60 * 1000); // Check again in an hour
    }

    async function startTLSProxy() {
        logger.info('Starting TLS proxy...');
        checkForRenew();

        let cert = fs.readFileSync(path.resolve(workDir, 'chain.pem'));
        let key = fs.readFileSync(path.resolve(workDir, 'privatekey.pem'));
        let server = tls.createServer({ key, cert }, (from) => {
            let to = net.createConnection({
                host: 'localhost',
                port: port
            });
            from.pipe(to);
            to.pipe(from);
        });
        server.listen(31002, () => {
            logger.info('TLS proxy started at ' + 31002);
            logger.info('Tunnel open: https://' + host);
        });
    }

    //
    // Certificate generation
    //
    async function generateCertificate() {
        if (fs.existsSync(path.resolve(workDir, 'privatekey.pem')) &&
            fs.existsSync(path.resolve(workDir, 'certificate.pem')) &&
            fs.existsSync(path.resolve(workDir, 'chain.pem'))) {

            const info = await acme.forge.readCertificateInfo(fs.readFileSync(path.resolve(workDir, 'certificate.pem')));
            if (info.domains.commonName.toLowerCase() === host) {
                let expire = new Date(info.notAfter).getTime();
                if (Date.now() <= expire) {
                    startTLSProxy();
                    return;
                }
            }
        }

        logger.info('Creating a certificate...');
        await fetchNewCertificates();
        logger.info('Certificate created');
        startTLSProxy();
    }

    // Starting tunnel
    logger.info('Establishing tunnel...');
    let tunnel = new ClientTunnel(31002, key, 'wss://backhaul.orcarium.com', async (path) => {
        if (path.startsWith('/acme-challenge/')) {
            let token = path.substring('/acme-challenge/'.length);
            if (acmeKeys.has(token)) {
                return Buffer.from(acmeKeys.get(token)!, 'ascii');
            }
        }
        return null;
    });
    let first = true;
    tunnel.onConnected = () => {
        if (first) {
            first = false;
            logger.info('Tunnel started');
            generateCertificate();
        } else {
            logger.info('Tunnel reconnected');
        }
    };
    tunnel.onDisconnected = () => {
        logger.info('Disconnected from tunnel');
    };
    tunnel.start();
}