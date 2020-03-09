import program from 'commander';
import { startClient } from "./client/startClient";
import { startFrontend } from './frontend/startFrontend';
import { startBackend } from './backend/startBackend';
import { startRegistrator } from './registrator/startRegistrator';
import { startAutoClient } from './client/startAutoClient';

function commaSeparatedList(value: string) {
    return value.split(',');
}
let handled = false;
program
    .command('frontend')
    .option('-p <port>', 'Listening port')
    .option('-ph <port>', 'Listening http port')
    .option('-s <servers>', 'NATS server endpoints', commaSeparatedList)
    .action(function (cmdObj) {
        handled = true;
        let port = cmdObj.P ? parseInt(cmdObj.P) : 9000;
        let httpPort = cmdObj.Ph ? parseInt(cmdObj.P) : 9005;
        startFrontend(port, httpPort, cmdObj.S);
    });
program
    .command('backend <key>')
    .option('-p <port>', 'Listening port')
    .option('-s <servers>', 'NATS server endpoints', commaSeparatedList)
    .action(function (keyP, cmdObj) {
        handled = true;
        let key = keyP as string;
        let port = cmdObj.P ? parseInt(cmdObj.P) : 9001;
        startBackend(key, port, cmdObj.S);
    });
program
    .command('registrator <host>')
    .option('-p <port>', 'Listening port')
    .action(function (hostP, cmdObj) {
        handled = true;
        let host = hostP as string;
        let port = cmdObj.P ? parseInt(cmdObj.P) : 9001;
        startRegistrator(port, host);
    });

program
    .command('client <server> <key>')
    .option('-ph <port>', 'Listening http port')
    .option('-p <port>', 'Local port')
    .action(function (server: string, key: string) {
        handled = true;
        let port = program.P ? parseInt(program.P) : 80;
        let httpPort = program.Ph ? parseInt(program.Ph) : 443;
        startClient(server, port, httpPort, key);
    });

program
    .option('-p <port>', 'Local port')

program.parse(process.argv);

if (!handled) {
    let port = program.P ? parseInt(program.P) : 8080;
    startAutoClient(port);
}