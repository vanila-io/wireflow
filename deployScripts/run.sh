#!/bin/sh
METEOR_SETTINGS=$(cat settings.json) pm2 start process.json
