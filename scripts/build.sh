#!/bin/bash

channel=$1

devkey=TODO
stagekey=TODO

if [ $channel == "dev" ]; then
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
fi

if [ $channel == "staging" ]; then
  pear seed staging &
  pear dump $devkey .
  pear stage staging
fi

if [ $channel == "rc" ]; then
  pear seed rc &
  pear dump $stagekey .
  pear stage rc
fi