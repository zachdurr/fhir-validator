import * as esbuild from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: false,
  logLevel: "info",
};

// Extension client — runs in the VSCode extension host
await esbuild.build({
  ...shared,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  format: "cjs",
  external: ["vscode"],
});

// Language server — runs as a separate process
await esbuild.build({
  ...shared,
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  format: "cjs",
});
