import program from 'commander';
import { startClientProxy } from "./client/startClientProxy";

program
    .command('client <url> <key>')
    .option('-p <port>', 'Local port')
    .action(function (hostP, keyP, cmdObj) {
        let port = cmdObj.P ? parseInt(cmdObj.P) : 443;
        let key = keyP as string;
        let host = hostP as string;
        startClientProxy(host, port, key);
    });

program.parse(process.argv);