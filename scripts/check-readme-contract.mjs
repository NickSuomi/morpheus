#!/usr/bin/env node

import { readFileSync } from "node:fs"

const readmePath = process.argv[2] ?? "README.md"
const readme = readFileSync(readmePath, "utf8")
const marker = readme.match(/<!--\s*github-readme-standard:\s*(full|compact)\s*-->/i)?.[1]?.toLowerCase()

if (!marker) {
  fail("missing <!-- github-readme-standard: full|compact --> marker")
}

const headings = [...readme.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)]
  .map((match) => match[1].trim().toLowerCase().replace(/\s+/g, " "))

const requirements = marker === "full"
  ? [
      ["What is", (heading) => heading.startsWith("what is")],
      ["Why", (heading) => heading === "why" || heading.startsWith("why ")],
      ["How it works", (heading) => heading === "how it works"],
      ["Quick start", (heading) => heading === "quick start"],
      ["Known limitations", (heading) => heading === "known limitations"],
      ["License", (heading) => heading === "license"],
    ]
  : [
      ["What it demonstrates", (heading) => heading === "what it demonstrates"],
      ["Run locally", (heading) => heading === "run locally"],
      ["Status and limitations", (heading) => heading === "status and limitations"],
      ["License", (heading) => heading === "license"],
    ]

const missing = requirements
  .filter(([, matches]) => !headings.some(matches))
  .map(([label]) => label)

if (missing.length > 0) {
  fail(`missing required headings for ${marker}: ${missing.join(", ")}`)
}

if (/Project name|One sentence:|Verified (install command|command or minimal example|minimal commands)/i.test(readme)) {
  fail("contains unresolved README template placeholder")
}

if (!(/\[[^\]]+\]\((?:\.\/)?LICENSE(?:\.md)?\)/i.test(readme) || /no license is currently granted/i.test(readme))) {
  fail("License section must link LICENSE or state that no license is currently granted")
}

console.log(`README contract passed: ${marker}`)

function fail(message) {
  console.error(`README contract failed: ${message}`)
  process.exit(1)
}
