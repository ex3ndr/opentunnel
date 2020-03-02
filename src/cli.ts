import program from 'commander';
import { startClientProxy } from "./client/startClientProxy";
import { startFrontend } from './frontend/startFrontend';
import { startBackend } from './backend/startBackend';

function commaSeparatedList(value: string) {
    return value.split(',');
}

program
    .command('client <url> <key>')
    .option('-p <port>', 'Local port')
    .action(function (hostP, keyP, cmdObj) {
        let port = cmdObj.P ? parseInt(cmdObj.P) : 443;
        let key = keyP as string;
        let host = hostP as string;
        startClientProxy(host, port, key);
    });
program
    .command('frontend')
    .option('-p <port>', 'Listening port')
    .option('-s <servers>', 'NATS server endpoints', commaSeparatedList)
    .action(function (cmdObj) {
        let port = cmdObj.P ? parseInt(cmdObj.P) : 9000;
        startFrontend(port, cmdObj.S);
    });
program
    .command('backend <key>')
    .option('-p <port>', 'Listening port')
    .option('-s <servers>', 'NATS server endpoints', commaSeparatedList)
    .action(function (keyP, cmdObj) {
        let key = keyP as string;
        let port = cmdObj.P ? parseInt(cmdObj.P) : 9001;
        startBackend(key, port, cmdObj.S);
    });
program.parse(process.argv);