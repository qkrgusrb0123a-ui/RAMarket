import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(scriptDirectory, '../..');
const mobileDirectory = path.join(repositoryDirectory, 'mobile');
const exportedWebDirectory = path.join(mobileDirectory, 'dist');
const publicWebDirectory = path.resolve(scriptDirectory, '../public/web');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args) {
  const result = spawnSync(npmCommand, args, { cwd: mobileDirectory, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.SKIP_WEB_INSTALL !== '1') run(['ci']);
run(['run', 'web:export']);
rmSync(publicWebDirectory, { recursive: true, force: true });
cpSync(exportedWebDirectory, publicWebDirectory, { recursive: true });
