import tls from 'tls';
import net from 'net';
import acme from 'acme-client';
import { backoff, delay } from '../utils/timer';
import { createLogger } from "../utils/createLogger";
import { registerRandomDomain } from '../registrator/registerRandomDomain';
import { ClientTunnel } from './ClientTunnel';

const logger = createLogger('client');

export interface ManagedTunnelConfig {
    host?: string | undefined | null;
    token?: string | undefined | null;

    acmeAccountKey?: string | undefined | null;
    certificate?: { chain: string, certificate: string, privateKey: string };
}

export class ManagedTunnel {
    readonly port: number;
    private _tlsPort: number = 0;
    private _config: ManagedTunnelConfig;
    private _tunnel!: ClientTunnel;
    private _acmeKeys = new Map<string, string>();
    private _tlsServer!: tls.Server;
    private _isReady: boolean = false;
    private _isConnected: boolean = false;

    onHostnameRegistered?: (host: string, token: string) => Promise<void>;
    onCertificateUpdated?: (cert: { chain: string, certificate: string, privateKey: string }) => Promise<void>;
    onACMEAccountKeyCreated?: (accountKey: string) => Promise<void>;

    onConnected?: () => void;
    onDisconnected?: () => void;
    onReady?: () => void;

    constructor(
        port: number,
        config: ManagedTunnelConfig
    ) {
        this.port = port;
        this._config = config;
    }

    get ready(): boolean {
        return this._isReady;
    }

    get connected(): boolean {
        return this._isConnected;
    }


    start = () => {
        logger.info('Starting TLS proxy...');
        this._tlsServer = tls.createServer(this._handleIncomingSocket);
        this._tlsServer.listen(undefined, 'localhost', () => {
            this._tlsPort = (this._tlsServer.address() as net.AddressInfo).port;
            logger.info('TLS proxy started at ' + this._tlsPort);
            this._ensureRegistration();
        });
    }

    private _ensureRegistration = async () => {
        if (this._config.host && this._config.token) {
            this._startTunnel();
            return;
        }
        logger.info('Registering hostname...');
        let reg = await backoff(() => registerRandomDomain());
        if (this.onHostnameRegistered) {
            await this.onHostnameRegistered(reg.host, reg.token);
        }
        this._config.host = reg.host;
        this._config.token = reg.token;
        logger.info('Got hostname: ' + reg.host);
        this._startTunnel();
    }

    private _startTunnel = () => {
        logger.info('Establishing tunnel...');
        this._tunnel = new ClientTunnel(
            this._tlsPort,
            Buffer.from(this._config.token!, 'base64'),
            'wss://backhaul.orcarium.com',
            this._handleWk
        );
        let first = true;
        this._tunnel.onConnected = () => {
            if (first) {
                first = false;
                logger.info('Tunnel Started');
                this._tunnelOpen();
            } else {
                logger.info('Tunnel Restarted');
            }
            if (!this._isConnected) {
                this._isConnected = true;
                if (this.onConnected) {
                    this.onConnected();
                }
            }
        };

        this._tunnel.onDisconnected = () => {
            logger.info('Tunnel Disconnected');
            if (this._isConnected) {
                this._isConnected = false;
                if (this.onDisconnected) {
                    this.onDisconnected();
                }
            }
        };
        this._tunnel.start();
    }

    private _tunnelOpen = async () => {

        // Check existing certificate
        if (this._config.certificate) {
            const info = await acme.forge.readCertificateInfo(this._config.certificate.certificate);
            if (info.domains.commonName.toLowerCase() === this._config.host) {
                let expire = new Date(info.notAfter).getTime();
                if (Date.now() <= expire) {
                    this._onReady();
                    return;
                } else {
                    logger.info('Existing certificate expired');
                }
            }
        }

        // Register a new one
        logger.info('Issuing a certificate...');
        let res = await backoff(async () => await this._fetchNewCertificates());
        if (this.onCertificateUpdated) {
            await this.onCertificateUpdated(res);
        }
        this._config.certificate = res;
        logger.info('Certificate issued');
        this._onReady();
    }

    private _onReady = () => {
        this._tlsServer.setSecureContext({ key: this._config.certificate!.privateKey, cert: this._config.certificate!.chain });
        this._isReady = true;
        if (this.onReady) {
            this.onReady();
        }
        this._refreshCertificateService();

        logger.info('Tunnel ready: https://' + this._config.host);
    }

    private _handleWk = async (path: string) => {
        if (path.startsWith('/acme-challenge/')) {
            let token = path.substring('/acme-challenge/'.length);
            if (this._acmeKeys.has(token)) {
                return Buffer.from(this._acmeKeys.get(token)!, 'ascii');
            }
        }
        return null;
    }

    private _handleIncomingSocket = (socket: tls.TLSSocket) => {
        if (!this._isReady) {
            socket.destroy();
            return;
        }
        let to = net.createConnection({
            host: 'localhost',
            port: this.port
        });
        socket.pipe(to);
        to.pipe(socket);
    }

    private _fetchNewCertificates = async () => {

        // Reuse account key
        if (!this._config.acmeAccountKey) {
            let accountKey = await acme.forge.createPrivateKey();
            let rawKey = accountKey.toString('base64');
            if (this.onACMEAccountKeyCreated) {
                await this.onACMEAccountKeyCreated(rawKey);
            }
            this._config.acmeAccountKey = rawKey;
        }
        let accountKey: Buffer = Buffer.from(this._config.acmeAccountKey, 'base64');

        try {
            const client = new acme.Client({
                directoryUrl: acme.directory.letsencrypt.production,
                accountKey: accountKey,
            });

            const [key, csr] = await acme.forge.createCsr({
                commonName: this._config.host!,
            });

            const cert = await client.auto({
                csr,
                termsOfServiceAgreed: true,
                skipChallengeVerification: true,
                challengePriority: ['http-01'],
                challengeCreateFn: async (authz, challenge, keyAuthorization) => {
                    this._acmeKeys.set(challenge.token, keyAuthorization);
                },
                challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
                    this._acmeKeys.delete(challenge.token);
                },
            });

            const chainArray = cert
                .trim()
                .split(/[\r\n]{2,}/g)
                .map((s) => `${s}\n`);
            let privateKey = key.toString();
            let chain = chainArray.join('\n');
            let certificate = chainArray[0];
            return { privateKey, chain, certificate };
        } catch (e) {
            logger.warn('Unable to generate certificate');
            logger.warn(e);
            throw e;
        }
    }

    private _refreshCertificateService = async () => {
        while (true) {
            const info = await acme.forge.readCertificateInfo(this._config.certificate!.certificate);

            let expire = new Date(info.notAfter).getTime();
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() + oneWeek <= expire) {
                // No need to renew
            } else {

                logger.info('Renewing certificate....');
                let res = await this._fetchNewCertificates();
                if (this.onCertificateUpdated) {
                    await this.onCertificateUpdated(res);
                }
                this._config.certificate = res;
                logger.info('Renewal successful');
            }

            await delay(60 * 60 * 1000); // Check again in an hour
        }
    }
}