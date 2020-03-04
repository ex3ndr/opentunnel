import program from 'commander';
import { startClient } from "./client/startClient";
import { startFrontend } from './frontend/startFrontend';
import { startBackend } from './backend/startBackend';
import { startRegistrator } from './registrator/startRegistrator';

function commaSeparatedList(value: string) {
    return value.split(',');
}

program
    .command('client <key>')
    .option('-s <server>', 'Custom server')
    .option('-p <port>', 'Local port')
    .option('-ph <port>', 'Listening http port')
    .action(function (keyP, cmdObj) {
        let port = cmdObj.P ? parseInt(cmdObj.P) : 443;
        let httpPort = cmdObj.Ph ? parseInt(cmdObj.Ph) : 80;
        let server = cmdObj.S ? cmdObj.S as string : 'wss://backhaul.orcarium.com'
        let key = keyP as string;
        startClient(server, port, httpPort, key);
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
program
    .command('registrator <host>')
    .option('-p <port>', 'Listening port')
    .action(function (hostP, cmdObj) {
        let host = hostP as string;
        let port = cmdObj.P ? parseInt(cmdObj.P) : 9001;
        startRegistrator(port, host);
    });
program.parse(process.argv);