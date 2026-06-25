import net from "node:net";
import fs from "node:fs";
import { spawn } from "node:child_process";

function loadDotEnv() {
  if (!fs.existsSync(".env")) return {};
  return Object.fromEntries(
    fs
      .readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}

const dotEnv = loadDotEnv();

const env = {
  ...process.env,
  ...dotEnv,
  DJANGO_DEBUG: process.env.DJANGO_DEBUG ?? "1",
  DJANGO_ALLOWED_HOSTS: process.env.DJANGO_ALLOWED_HOSTS ?? "localhost,127.0.0.1",
  CSRF_TRUSTED_ORIGINS:
    process.env.CSRF_TRUSTED_ORIGINS ??
    "http://localhost:3000,http://127.0.0.1:3000",
  POSTGRES_DB: process.env.POSTGRES_DB ?? dotEnv.POSTGRES_DB ?? "meal_registry",
  POSTGRES_USER: process.env.POSTGRES_USER ?? dotEnv.POSTGRES_USER ?? "meal_registry",
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? dotEnv.POSTGRES_PASSWORD ?? "meal_registry",
  POSTGRES_HOST: process.env.POSTGRES_HOST ?? "localhost",
  POSTGRES_PORT: process.env.POSTGRES_PORT ?? dotEnv.POSTGRES_PORT ?? "5432",
  DJANGO_SUPERUSER_USERNAME: process.env.DJANGO_SUPERUSER_USERNAME ?? dotEnv.DJANGO_SUPERUSER_USERNAME ?? "admin",
  DJANGO_SUPERUSER_EMAIL: process.env.DJANGO_SUPERUSER_EMAIL ?? dotEnv.DJANGO_SUPERUSER_EMAIL ?? "admin@example.local",
  DJANGO_SUPERUSER_PASSWORD:
    process.env.DJANGO_SUPERUSER_PASSWORD ?? dotEnv.DJANGO_SUPERUSER_PASSWORD ?? "ChangeMe123!",
};

const python = process.env.PYTHON ?? "python";
const host = env.POSTGRES_HOST;
const port = Number(env.POSTGRES_PORT);

function waitForPostgres() {
  const deadline = Date.now() + 60_000;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(2000);
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", retry);
      socket.once("timeout", retry);

      function retry(error) {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(error ?? new Error(`Timed out waiting for PostgreSQL at ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1000);
      }
    };
    attempt();
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env, shell: false });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

console.log(`Waiting for PostgreSQL at ${host}:${port}...`);
await waitForPostgres();

await run(python, ["manage.py", "migrate", "--noinput"]);
await run(python, ["manage.py", "bootstrap_registry"]);

console.log("Starting Django dev server on http://127.0.0.1:3000");
await run(python, ["manage.py", "runserver", "127.0.0.1:3000"]);
