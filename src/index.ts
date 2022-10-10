import fs from 'fs';
import { resolve } from 'path';
import { createIppServer } from './ipp-server/create-ipp-server';

fs.mkdirSync(resolve(process.env.PWD as string, 'temp/'), { recursive: true });

createIppServer();

export const Index = true;
