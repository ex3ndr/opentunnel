import program from 'commander';
import { startClient } from "./client/startClient";
import { startFrontend } from './frontend/startFrontend';
import { startBackend } from './backend/startBackend';

function commaSeparatedList(value: string) {
    return value.split(',');
}

program
    .command('client <url> <key>')
    .option('-p <port>', 'Local port')
    .option('-ph <port>', 'Listening http port')
    .action(function (hostP, keyP, cmdObj) {
        let port = cmdObj.P ? parseInt(cmdObj.P) : 443;
        let httpPort = cmdObj.Ph ? parseInt(cmdObj.Ph) : 80;
        let key = keyP as string;
        let host = hostP as string;
        startClient(host, port, httpPort, key);
    });
program
    .command('frontend')
    .option('-p <port>', 'Listening port')
    .option('-ph <port>', 'Listening http port')
    .option('-s <servers>', 'NATS server endpoints', commaSeparatedList)
    .action(function (cmdObj) {
        let port = cmdObj.P ? parseInt(cmdObj.P) : 9000;
        let httpPort = cmdObj.Ph ? parseInt(cmdObj.P) : 9005;
        startFrontend(port, httpPort, cmdObj.S);
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