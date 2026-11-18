#!/usr/bin/env bash
# Proves the secret scan catches what FT-001 requires: a Supabase secret key, Twilio,
# Resend, RevenueCat secret, AWS or vendor key in the code, or in any variable starting
# EXPO_PUBLIC_ or NEXT_PUBLIC_. Each case is written to a throwaway folder and must fail.
#
# The fake keys are assembled at run time so this file never contains a key-shaped string.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/.gitleaks.toml"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

rand() { (LC_ALL=C tr -dc "$1" </dev/urandom || true) | head -c "$2"; }

EP="EXPO""_PUBLIC_"
NP="NEXT""_PUBLIC_"
SUPABASE_SECRET="sb_""secret_$(rand 'A-Za-z0-9' 32)"
RESEND="re_""$(rand 'A-Za-z0-9' 8)_$(rand 'A-Za-z0-9' 24)"
REVENUECAT="sk_""$(rand 'A-Za-z0-9' 32)"
TWILIO_KEY="SK""$(rand '0-9a-f' 32)"
TWILIO_SID="AC""$(rand '0-9a-f' 32)"
AWS_ID="AKIA""$(rand 'A-Z2-7' 16)"
VENDOR="$(rand 'A-Za-z0-9' 40)"

declare -a NAMES=()
declare -a BODIES=()
add_case() { NAMES+=("$1"); BODIES+=("$2"); }

add_case "Supabase secret key in code" "const key = '$SUPABASE_SECRET';"
add_case "Resend key in code" "const resend = '$RESEND';"
add_case "RevenueCat secret key in code" "const rc = '$REVENUECAT';"
add_case "Twilio API key in code" "const twilio = '$TWILIO_KEY';"
add_case "Twilio account SID in code" "const sid = '$TWILIO_SID';"
add_case "AWS access key in code" "const aws = '$AWS_ID';"
add_case "Age-check vendor key in config" "VERIFICATION_VENDOR_API_KEY=$VENDOR"
add_case "Secret value in an ${EP} variable" "${EP}SUPABASE_PUBLISHABLE_KEY=$SUPABASE_SECRET"
add_case "Secret value in a ${NP} variable" "${NP}SUPABASE_PUBLISHABLE_KEY=$REVENUECAT"
add_case "Secret-named ${EP} variable" "${EP}STRIPE_SECRET=abc"
add_case "Secret-named ${NP} variable" "${NP}SERVICE_ROLE=abc"

failures=0

for i in "${!NAMES[@]}"; do
  dir="$WORK/case-$i"
  mkdir -p "$dir"
  printf '%s\n' "${BODIES[$i]}" >"$dir/sample.ts"

  caught=no
  if ! gitleaks dir "$dir" --config "$CONFIG" --no-banner --log-level error --exit-code 1 >/dev/null 2>&1; then
    caught=yes
  fi
  if ! node "$ROOT/scripts/check-public-env.mjs" "$dir" >/dev/null 2>&1; then
    caught=yes
  fi

  if [ "$caught" = yes ]; then
    echo "PASS  caught: ${NAMES[$i]}"
  else
    echo "FAIL  missed: ${NAMES[$i]}"
    failures=$((failures + 1))
  fi
done

# A clean file with only approved public names and a public RevenueCat SDK key must pass.
clean="$WORK/clean"
mkdir -p "$clean"
printf '%s\n' "${EP}SUPABASE_URL=https://example.supabase.co" "${EP}REVENUECAT_IOS_KEY=appl_$(rand 'A-Za-z0-9' 20)" >"$clean/.env.example"
if gitleaks dir "$clean" --config "$CONFIG" --no-banner --log-level error --exit-code 1 >/dev/null 2>&1 &&
  node "$ROOT/scripts/check-public-env.mjs" "$clean" >/dev/null 2>&1; then
  echo "PASS  clean file accepted"
else
  echo "FAIL  clean file was rejected"
  failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures secret scan case(s) failed."
  exit 1
fi
echo "Secret scan self-test passed."
