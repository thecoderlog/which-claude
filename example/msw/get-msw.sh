#!/bin/sh
# get-msw.sh: Mock Service Worker as it was the day before the fix (commit edeb058, msw 2.13.4, 17 April 2026).
# The copy is one commit with no history, so an agent can't read the fix out of git. Dependencies are installed
# and the library is built, like a developer's working copy. About 3 minutes and 500 MB, in ./repo.
set -e
cd "$(dirname "$0")"
BASE=edeb0585e53389875ba5e5b034854ebaa2f2f8e7
PNPM="npx --yes pnpm@9.15.0"
rm -rf .src repo
mkdir .src
git -C .src init -q
git -C .src fetch -q --depth 1 https://github.com/mswjs/msw.git "$BASE"
mkdir repo
git -C .src archive --format=tar "$BASE" | tar x -C repo
rm -rf .src
cd repo
git init -q -b main
git add -A
git -c user.name=snapshot -c user.email=snapshot@example.invalid commit -qm "msw 2.13.4 (main at edeb058, 2026-04-17)"
CI=1 $PNPM install --frozen-lockfile --ignore-scripts
CI=1 $PNPM build
echo "ready: cd repo, then run which-claude as in README.md"
