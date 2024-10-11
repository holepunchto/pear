#!/bin/bash

./pear.dev sidecar shutdown

npm i

rm -fr by-arch
npm run archdump

rm -rf ./node_modules
npm i --omit=dev
npm run prune

./pear.dev sidecar &
./pear.dev seed dev &
rm package-lock.json

./pear.dev stage dev
