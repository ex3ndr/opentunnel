import program from 'commander';
import { startClientProxy } from "./client/startClientProxy";
import { startFrontend } from './frontend/startFrontend';
import { startBackend } from './backend/startBackend';

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
    .action(function (cmdObj) {
        let port = cmdObj.P ? parseInt(cmdObj.P) : 9000;
        startFrontend(port);
    });
program
    .command('backend <key>')
    .option('-p <port>', 'Listening port')
    .action(function (keyP, cmdObj) {
        let key = keyP as string;
        let port = cmdObj.P ? parseInt(cmdObj.P) : 9001;
        startBackend(key, port);
    });
program.parse(process.argv);