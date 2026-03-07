import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd = process.cwd();
const lockPath = path.join(cwd, ".next", "dev", "lock");

function getPortFromArgs(args) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--port" || arg === "-p") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) return Number(next);
    }
    if (arg.startsWith("--port=")) return Number(arg.split("=")[1]);
    if (arg.startsWith("-p=")) return Number(arg.split("=")[1]);
  }
  return 3000;
}

function killPortIfInUse(port) {
  if (!Number.isFinite(port) || port <= 0) return;

  if (process.platform === "win32") {
    const findPid = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
      ],
      { encoding: "utf8" },
    );

    const pids = (findPid.stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line));

    for (const pid of pids) {
      spawnSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
      console.log(`[dev-safe] Terminated process ${pid} using port ${port}`);
    }
    return;
  }

  const findPid = spawnSync("sh", ["-lc", `lsof -ti tcp:${port}`], {
    encoding: "utf8",
  });
  const pids = (findPid.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const pid of pids) {
    spawnSync("kill", ["-9", pid], { stdio: "ignore" });
    console.log(`[dev-safe] Terminated process ${pid} using port ${port}`);
  }
}

if (existsSync(lockPath)) {
  try {
    rmSync(lockPath, { force: true });
    console.log("[dev-safe] Removed stale .next/dev/lock");
  } catch (err) {
    console.warn("[dev-safe] Could not remove lock file:", err?.message || err);
  }
}

const passthroughArgs = process.argv.slice(2);
const port = getPortFromArgs(passthroughArgs);
killPortIfInUse(port);

const nextDev = spawnSync("npm", ["run", "dev:raw", "--", ...passthroughArgs], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(nextDev.status ?? 1);
