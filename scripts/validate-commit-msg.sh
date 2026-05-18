#!/bin/sh
set -eu

usage() {
  printf '%s\n' "usage: $0 <commit-message-file>" >&2
}

fail() {
  printf '%s\n' "commit message validation failed: $1" >&2
  printf '%s\n' "expected subject: <type>: <imperative summary>" >&2
  printf '%s\n' "allowed types: docs, feat, fix, refactor, test, chore, spike, decision" >&2
  printf '%s\n' "subject length limit: 72 characters" >&2
  exit 1
}

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi

message_file=$1

if [ ! -f "$message_file" ]; then
  fail "message file does not exist: $message_file"
fi

subject=$(awk 'NF && $0 !~ /^[[:space:]]*#/ { print; exit }' "$message_file")

if [ -z "$subject" ]; then
  fail "subject is empty"
fi

case "$subject" in
  Merge\ * | Revert\ \"*\" | Revert\ \'*\' | Revert\ *)
    exit 0
    ;;
esac

if [ "${#subject}" -gt 72 ]; then
  fail "subject is longer than 72 characters"
fi

case "$subject" in
  *": "*)
    type=${subject%%: *}
    summary=${subject#*: }
    ;;
  *)
    fail "subject must contain ': ' after the type"
    ;;
esac

case "$type" in
  docs | feat | fix | refactor | test | chore | spike | decision)
    ;;
  *)
    fail "unsupported type '$type'"
    ;;
esac

if [ -z "$(printf '%s' "$summary" | tr -d '[:space:]')" ]; then
  fail "summary is empty"
fi

first_word=${summary%% *}

case "$first_word" in
  *[!abcdefghijklmnopqrstuvwxyz-]*)
    fail "summary must start with a lowercase imperative verb"
    ;;
  *ed | *ing | *s)
    fail "summary must start with an imperative verb, not past or present tense"
    ;;
esac
