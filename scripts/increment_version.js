#!/usr/local/bin/node
const fs = require('fs');
const path = require('path');
const semver = require('semver');
const versionPath = path.resolve(__dirname, '..', 'package.json');
let pkg = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
pkg.version = semver.inc(pkg.version, 'patch');
fs.writeFileSync(versionPath, JSON.stringify(pkg, null, 2));