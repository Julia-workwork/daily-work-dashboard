#!/bin/zsh
cd "$(dirname "$0")"

NODE_PATH="/Users/Zhuanz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
ENV_FILE=".env.local"

if [ ! -x "$NODE_PATH" ]; then
  echo "Cannot find Codex Node runtime:"
  echo "$NODE_PATH"
  echo ""
  echo "Please ask Codex to update this launcher."
  read -k 1 "?Press any key to close..."
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  echo "Loading local Notion settings from $ENV_FILE"
  set -a
  source "$ENV_FILE"
  set +a
  echo ""
fi

echo "Starting Daily Work Dashboard..."
echo "Open this URL in your browser:"
echo "http://127.0.0.1:5175/"
echo ""
if [ -z "$NOTION_TOKEN" ] && [ -z "$NOTION_API_KEY" ]; then
  echo "Notion save is not configured yet."
  echo "New tasks will stay as local drafts unless NOTION_TOKEN is set in .env.local."
  echo ""
else
  echo "Notion save is enabled for Workflow Tasks."
  echo ""
fi
echo "Keep this window open while using the dashboard."
echo "Press Control-C to stop."
echo ""

PORT=5175 "$NODE_PATH" server.mjs
