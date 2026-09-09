import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Writable } from 'node:stream';
import { createPasswordHash } from '../services/password-hash.js';

let muted = false;
const hiddenOutput = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) output.write(chunk);
    callback();
  }
});
const prompt = createInterface({ input, output: hiddenOutput, terminal: true });
output.write('관리자 비밀번호(12자 이상): ');
muted = true;
const password = await prompt.question('');
muted = false;
output.write('\n');
prompt.close();

if (password.length < 12) {
  console.error('관리자 비밀번호는 12자 이상이어야 합니다.');
  process.exitCode = 1;
} else {
  console.log(`ADMIN_PASSWORD_HASH=${createPasswordHash(password)}`);
}
