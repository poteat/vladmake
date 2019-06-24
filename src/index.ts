#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import * as readline from "readline";
import chalk from "chalk";
import path from "path";
import * as _ from "lodash";
import { spawn, exec } from "child_process";

console.log(chalk.grey("Specify project details"));
console.log(chalk.grey("Press ^C at any time to quit\n"));

const folderName = path.resolve(".").replace(/.*\//, "");

let state = 0;

const messages = [
  "Package Name",
  "Description",
  "Keywords",
  "Author",
  "License"
];

const defaults = [folderName, "", "", "", "MIT"];

const regex = [/^(@.+\/)?[^._\s]\S+$/, /.+/, /.+/, /.+/, /.+/];

const responses = [];
const rl = readline.createInterface(process.stdin, process.stdout);

const setPrompt = () =>
  rl.setPrompt(
    chalk.whiteBright.bold(
      `${messages[state]}${defaults[state] ? ` (${defaults[state]})` : ""}: `
    )
  );

setPrompt();
rl.prompt();
rl.on("line", function(line) {
  const response = line ? line : defaults[state];
  if (response !== "" && regex[state].test(response)) {
    responses.push(_.trim(line) ? _.trim(line) : defaults[state]);
    if (responses.length == messages.length) {
      rl.close();
    } else {
      state++;
      setPrompt();
    }
  } else {
    console.log(`  Doesn't match ${regex[state]}.`);
  }
  if (responses.length !== messages.length) {
    rl.prompt();
  }
}).on("close", () => {
  const [name, description, keywords, author, license] = responses;

  let gitUrl = "";
  try {
    const gitFileContents = readFileSync("./.git/config", "utf8");
    gitUrl = gitFileContents.match(/(?<=url = ).+/)[0];
  } catch (e) {
    console.log(e);
  }

  const packageObj = {
    name,
    description,
    keywords: _.chain(keywords.split(","))
      .map(s => _.trim(s))
      .uniq()
      .filter()
      .value(),
    author,
    license,
    main: "dist/index.js",
    version: "1.0.0",
    scripts: {
      test: "jest --json --outputFile coverage/testResults.json && shieldgen"
    },
    repository: {
      type: "git",
      url: gitUrl ? gitUrl : ""
    }
  };

  if (folderName != "vladmake") {
    writeFileSync("package.json", JSON.stringify(packageObj, null, 2));
  }

  console.log(packageObj);
  console.log("");
  console.log(
    chalk.greenBright.bold("Installing dependencies... may take a while!")
  );

  const npm = spawn("npm", [
    "i",
    "-D",
    "@types/jest",
    "@types/node",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "eslint",
    "eslint-config-prettier",
    "eslint-plugin-jest",
    "eslint-plugin-prettier",
    "eslint-plugin-promise",
    "jest",
    "prettier",
    "ts-jest",
    "ts-loader",
    "typescript",
    "shieldgen"
  ]);

  npm.stdout.setEncoding("utf8");

  npm.stdout.on("data", data => {
    const str = data.toString();
    const lines = str.split(/(\r?\n)/g);
    console.log(lines.join(""));
  });

  npm.on("close", code => {
    if (code !== 0) {
      console.error("Some npm error occured on dependency installation");
      process.exit(1);
    }

    const readme = [
      `# ${name}`,
      `${description}.`,
      `# Installation`,
      `\`\`\`sh\nnpm i ${name}\n\`\`\`\n\n# Usage`,
      `\`\`\`js\nimport {} from "${name}"\n\`\`\`\n`
    ].join("\n\n");

    writeFileSync("readme.md", readme);

    const copy = exec(
      "cp " + ["-r", `${__dirname}/../templates/*`, "."].join(" ")
    );

    copy.on("close", code => {
      if (code !== 0) {
        console.error("Some error occured on copying files");
        process.exit(1);
      }

      console.log(chalk.greenBright.bold("All done!!!  Have fun."));

      process.exit(0);
    });
  });
});
