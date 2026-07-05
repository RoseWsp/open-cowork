/**
 * Windows Console Window Suppression Patch
 *
 * On Windows, every child_process.spawn / exec / execFile call that launches a
 * console-subsystem executable (e.g. cmd.exe, powershell.exe, python.exe, bash.exe,
 * docker.exe, wsl.exe) gets a brand-new console window allocated by the OS, even
 * when the caller redirects stdio. This flashes a black console box on the user's
 * screen — very distracting.
 *
 * Node.js supports `windowsHide: true` per-call (mapped to CREATE_NO_WINDOW), but:
 *  1. Third-party libraries (MCP SDK, agent frameworks, etc.) don't set it.
 *  2. Grandchild processes of our own spawns still get consoles because the flag
 *     is not inherited — each CreateProcess call must set it independently.
 *
 * This module monkey-patches child_process.spawn / exec / execFile / execSync /
 * execFileSync / spawnSync to always inject windowsHide: true on Windows. It
 * runs at module-load time and catches:
 *  - All `require('child_process').spawn(...)` style calls from any module.
 *  - Late-bound / dynamic imports that resolve after this patch.
 *  - Third-party libraries that access child_process through the cached module.
 *
 * The one case it does NOT cover: CommonJS modules that destructure at the top
 * level (e.g. `const { spawn } = require('child_process')`). Those capture a
 * local reference before the patch runs. For those, ensure the source file has
 * an explicit `windowsHide: true` — grep for existing usages in the codebase.
 */
/* eslint-disable @typescript-eslint/no-var-requires */

// Workaround: `import { spawn } from 'child_process'` gets the ESM live binding.
// By re-exporting from here after patching, any module that imports from this
// file gets the patched version. Modules that import directly from 'child_process'
// via ESM get the live binding to the patched properties since we mutate the
// cached CommonJS exports object that Node.js's ESM loader reads from.

if (process.platform === 'win32') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cp = require('child_process');

    // ---- spawn ----
    const _spawn = cp.spawn;
    cp.spawn = function patchedSpawn(cmd: any, args?: any, opts?: any) {
      if (opts) {
        opts.windowsHide = true;
      } else if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
        // spawn(cmd, options) — second arg is options, not args
        (args as any).windowsHide = true;
      } else {
        opts = { windowsHide: true };
      }
      return _spawn.call(this, cmd, args, opts);
    };

    // ---- exec ----
    const _exec = cp.exec;
    cp.exec = function patchedExec(cmd: any, opts?: any, cb?: any) {
      if (typeof opts === 'function') {
        cb = opts;
        opts = { windowsHide: true };
      } else if (opts) {
        opts.windowsHide = true;
      } else {
        opts = { windowsHide: true };
      }
      return _exec.call(this, cmd, opts, cb);
    };

    // ---- execFile ----
    const _execFile = cp.execFile;
    cp.execFile = function patchedExecFile(file: any, args?: any, opts?: any, cb?: any) {
      if (typeof args === 'function') {
        cb = args;
        args = undefined;
        opts = { windowsHide: true };
      } else if (typeof opts === 'function') {
        cb = opts;
        opts = args = undefined;
      }
      if (opts) {
        opts.windowsHide = true;
      } else if (args && typeof args === 'object' && !Array.isArray(args)) {
        (args as any).windowsHide = true;
      } else {
        opts = { windowsHide: true };
      }
      return _execFile.call(this, file, args, opts, cb);
    };

    // ---- execSync ----
    const _execSync = cp.execSync;
    cp.execSync = function patchedExecSync(cmd: any, opts?: any) {
      if (opts) {
        opts.windowsHide = true;
      } else {
        opts = { windowsHide: true };
      }
      return _execSync.call(this, cmd, opts);
    };

    // ---- execFileSync ----
    const _execFileSync = cp.execFileSync;
    cp.execFileSync = function patchedExecFileSync(file: any, args?: any, opts?: any) {
      if (opts) {
        opts.windowsHide = true;
      } else if (args && typeof args === 'object' && !Array.isArray(args)) {
        (args as any).windowsHide = true;
      } else {
        opts = { windowsHide: true };
      }
      return _execFileSync.call(this, file, args, opts);
    };

    // ---- spawnSync ----
    const _spawnSync = cp.spawnSync;
    cp.spawnSync = function patchedSpawnSync(cmd: any, args?: any, opts?: any) {
      if (opts) {
        opts.windowsHide = true;
      } else if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
        (args as any).windowsHide = true;
      } else {
        opts = { windowsHide: true };
      }
      return _spawnSync.call(this, cmd, args, opts);
    };
  } catch {
    // If patching fails (e.g., in a test environment without child_process),
    // silently continue. This is a best-effort improvement.
  }
}

// Re-export everything from child_process so this module is a drop-in replacement.
// Modules that `import { spawn } from './patches/windows-hide-patch'` get patched ones.
export * from 'child_process';
