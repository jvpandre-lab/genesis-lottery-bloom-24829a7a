import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const cmd = 'npx vitest run src/test/advanced.test.ts src/test/backtestSmallCases.test.ts src/test/temporalLeakage.test.ts --reporter=verbose';
let output = '';

try {
  output += `Command: ${cmd}\n\n`;
  const result = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
  output += result;
  output += '\n\nRESULT: SUCCESS\n';
} catch (err) {
  output += `ERROR: ${err instanceof Error ? err.message : String(err)}\n\n`;
  if (err && typeof err === 'object' && 'stderr' in err) {
    try {
      output += `STDERR:\n${(err as any).stderr}\n`;
    } catch {}
  }
  if (err && typeof err === 'object' && 'stdout' in err) {
    try {
      output += `STDOUT:\n${(err as any).stdout}\n`;
    } catch {}
  }
  output += '\nRESULT: FAILURE\n';
}

writeFileSync('validateImmediate.log', output, 'utf-8');
console.log('Validation complete: see validateImmediate.log');
