import { ManagedTunnel } from './ManagedTunnel';
import fs from 'fs';
import path from 'path';

export async function startAutoClient(port: number) {

    // Resolve config
    let workDir = path.resolve('.opentunnel');
    if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir);
    }
    let configPath = path.resolve(workDir, 'config.json');
    let host: string | null = null;
    let token: string | null = null;
    let certificate: string | null = null;
    let chain: string | null = null;
    let privateKey: string | null = null;
    let accountKey: string | null = null;
    if (fs.existsSync(configPath)) {
        let cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (typeof cfg.host === 'string' && typeof cfg.token === 'string') {
            host = cfg.host;
            token = cfg.token;
        }
    }
    if (fs.existsSync(path.resolve(workDir, 'privatekey.pem')) &&
        fs.existsSync(path.resolve(workDir, 'certificate.pem')) &&
        fs.existsSync(path.resolve(workDir, 'chain.pem')) &&
        fs.existsSync(path.resolve(workDir, 'account.key'))) {
        certificate = fs.readFileSync(path.resolve(workDir, 'certificate.pem'), 'utf-8');
        chain = fs.readFileSync(path.resolve(workDir, 'chain.pem'), 'utf-8');
        privateKey = fs.readFileSync(path.resolve(workDir, 'privatekey.pem'), 'utf-8');
        accountKey = fs.readFileSync(path.resolve(workDir, 'account.key'), 'utf-8');
    }

    let managedTunnel = new ManagedTunnel(port, {
        host, token,
        acmeAccountKey: accountKey,
        certificate: certificate && chain && privateKey ? { certificate: certificate, chain: chain!, privateKey } : undefined
    });
    managedTunnel.onACMEAccountKeyCreated = async (accountKey) => {
        fs.writeFileSync(path.resolve(workDir, 'account.key'), accountKey);
    };
    managedTunnel.onCertificateUpdated = async (cert) => {
        fs.writeFileSync(path.resolve(workDir, 'privatekey.pem'), cert.privateKey);
        fs.writeFileSync(path.resolve(workDir, 'certificate.pem'), cert.certificate);
        fs.writeFileSync(path.resolve(workDir, 'chain.pem'), cert.chain);
    };
    managedTunnel.onHostnameRegistered = async (host, token) => {
        fs.writeFileSync(configPath, JSON.stringify({ host, token }), 'utf-8');
    };
    managedTunnel.start();
}