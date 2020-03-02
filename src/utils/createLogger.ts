import pino from 'pino';

export function createLogger(name: string) {
    return pino({ prettyPrint: { ignore: 'hostname,pid' }, name });
}