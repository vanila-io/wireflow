#!/bin/sh
BUILD_PATH="../wireflow.co_3001"
rm -rf $BUILD_PATH
mkdir $BUILD_PATH
rm -rf node_modules
npm install
meteor build --directory $BUILD_PATH
cp settings.json $BUILD_PATH/
cp deployScripts/*.* $BUILD_PATH/
