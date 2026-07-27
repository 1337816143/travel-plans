import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT=process.cwd();
console.log('Travel data Schema validator initialized at',path.basename(ROOT));
