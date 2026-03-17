const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const isWatch = process.argv.includes("--watch");

// Build plugin code (runs in Figma sandbox)
const codeBuild = {
  entryPoints: ["src/plugin/main.ts"],
  bundle: true,
  outfile: "dist/code.js",
  target: "es2017",
  format: "iife",
  loader: { ".json": "json" },
};

// Build UI code (runs in iframe)
const uiBuild = {
  entryPoints: ["src/ui/ui.ts"],
  bundle: true,
  outfile: "dist/ui.js",
  target: "es2020",
  format: "iife",
  loader: { ".json": "json" },
  plugins: [
    {
      name: "html-inline",
      setup(build) {
        build.onEnd(() => {
          const html = fs.readFileSync(
            path.resolve("src/ui/index.html"),
            "utf8"
          );
          const js = fs.readFileSync(path.resolve("dist/ui.js"), "utf8");
          const final = html.replace(
            "<!-- SCRIPT -->",
            `<script>${js}</script>`
          );
          fs.writeFileSync(path.resolve("dist/ui.html"), final);
        });
      },
    },
  ],
};

async function build() {
  if (isWatch) {
    const codeCtx = await esbuild.context(codeBuild);
    const uiCtx = await esbuild.context(uiBuild);
    await codeCtx.watch();
    await uiCtx.watch();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(codeBuild);
    await esbuild.build(uiBuild);
    console.log("Build complete.");
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
