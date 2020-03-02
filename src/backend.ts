import fs from 'fs';
import { startBackend } from './backend/startBackend';
let publicKey = fs.readFileSync('auth_public.key', 'ascii');
startBackend(publicKey, 9001);