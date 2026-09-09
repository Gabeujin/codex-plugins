#!/usr/bin/env node

import {
  buildPublicRelease
} from "./build-public-release-v3.mjs";

console.log(
  JSON.stringify(await buildPublicRelease(), null, 2)
);
