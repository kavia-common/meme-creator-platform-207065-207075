#!/bin/bash
cd /home/kavia/workspace/code-generation/meme-creator-platform-207065-207075/meme_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

