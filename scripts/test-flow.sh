#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-flow.sh — Full end-to-end API test
# Tests: token generation → gateway → MI → backend → response
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

IS_URL="https://localhost:9444"
GW_URL="https://localhost:8243"
SMOKE_ONLY=${1:-""}

GREEN='\033[0;32m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0

pass() { echo -e "${GREEN}[PASS]${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}[FAIL]${NC} $1"; FAIL=$((FAIL+1)); }
log()  { echo -e "${BLUE}[test]${NC} $1"; }

# ─── Prerequisites check ─────────────────────────────────────────────────────
check_prereqs() {
  log "Checking prerequisites..."
  command -v curl &>/dev/null || { echo "curl required"; exit 1; }
  command -v jq   &>/dev/null || { echo "jq required"; exit 1; }
  log "Prerequisites OK"
}

# ─── Get OAuth2 token ────────────────────────────────────────────────────────
get_token() {
  local client_id=$1
  local client_secret=$2
  local scope=${3:-"plan:read network:read usage:read"}

  TOKEN=$(curl -sk -X POST "$IS_URL/oauth2/token" \
    -d "grant_type=client_credentials" \
    -d "client_id=$client_id" \
    -d "client_secret=$client_secret" \
    -d "scope=$scope" \
    | jq -r '.access_token')

  if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    fail "Failed to obtain access token"
    return 1
  fi
  pass "OAuth2 token obtained (${#TOKEN} chars)"
  export TOKEN
}

# ─── Test backend services directly (no auth) ────────────────────────────────
test_backends_direct() {
  log "━━━━ Testing Node.js backends directly ━━━━"

  # Plan service health
  STATUS=$(curl -so /dev/null -w "%{http_code}" http://localhost:9091/health)
  [ "$STATUS" == "200" ] && pass "plan-service health: $STATUS" || fail "plan-service health: $STATUS"

  # Plan service REST
  COUNT=$(curl -s http://localhost:9091/v1/plans | jq '.total')
  [ "$COUNT" -gt "0" ] 2>/dev/null && pass "plan-service returned $COUNT plans" || fail "plan-service returned no plans"

  # Plan service filter
  COUNT=$(curl -s "http://localhost:9091/v1/plans?type=wholesale" | jq '.total')
  [ "$COUNT" -gt "0" ] 2>/dev/null && pass "plan-service filter by type works ($COUNT results)" || fail "plan-service filter failed"

  # Network service health
  STATUS=$(curl -so /dev/null -w "%{http_code}" http://localhost:9092/health)
  [ "$STATUS" == "200" ] && pass "network-service health: $STATUS" || fail "network-service health: $STATUS"

  # Network service regions
  COUNT=$(curl -s http://localhost:9092/v1/network/status | jq '.total')
  [ "$COUNT" -gt "0" ] 2>/dev/null && pass "network-service returned $COUNT regions" || fail "network-service returned no regions"

  # Usage service health
  STATUS=$(curl -so /dev/null -w "%{http_code}" http://localhost:9093/health)
  [ "$STATUS" == "200" ] && pass "usage-service health: $STATUS" || fail "usage-service health: $STATUS"

  # Usage service subscriber
  STATUS=$(curl -so /dev/null -w "%{http_code}" http://localhost:9093/v1/usage/SUB-001)
  [ "$STATUS" == "200" ] && pass "usage-service subscriber lookup: $STATUS" || fail "usage-service subscriber: $STATUS"
}

# ─── Test gateway security (no token should fail) ────────────────────────────
test_gateway_security() {
  log "━━━━ Testing gateway security ━━━━"

  # No token → 401
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "$GW_URL/telecom/plan/v1/plans")
  [ "$STATUS" == "401" ] && pass "Gateway blocks request without token: $STATUS" || fail "Gateway allowed unauthenticated request: $STATUS"

  # Invalid token → 401
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer invalid.token.here" \
    "$GW_URL/telecom/plan/v1/plans")
  [ "$STATUS" == "401" ] && pass "Gateway rejects invalid token: $STATUS" || fail "Gateway accepted invalid token: $STATUS"
}

# ─── Test full flow via gateway (requires token) ─────────────────────────────
test_gateway_apis() {
  local token=$1
  log "━━━━ Testing APIs through gateway ━━━━"

  # Plan API - list all
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    "$GW_URL/telecom/plan/v1/plans")
  [ "$STATUS" == "200" ] && pass "Plan API GET /plans: $STATUS" || fail "Plan API GET /plans: $STATUS"

  # Plan API - single plan
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    "$GW_URL/telecom/plan/v1/plans/P001")
  [ "$STATUS" == "200" ] && pass "Plan API GET /plans/P001: $STATUS" || fail "Plan API GET /plans/P001: $STATUS"

  # Plan API - 404
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    "$GW_URL/telecom/plan/v1/plans/P999")
  [ "$STATUS" == "404" ] && pass "Plan API GET /plans/P999 returns 404" || fail "Plan API 404 not working: $STATUS"

  # Plan API - filter
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    "$GW_URL/telecom/plan/v1/plans?type=prepaid")
  [ "$STATUS" == "200" ] && pass "Plan API filter by type: $STATUS" || fail "Plan API filter: $STATUS"

  # Network Status API
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    "$GW_URL/telecom/network/v1/network/status")
  [ "$STATUS" == "200" ] && pass "Network API GET /network/status: $STATUS" || fail "Network API: $STATUS"

  # Network API - incidents
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    "$GW_URL/telecom/network/v1/network/incidents")
  [ "$STATUS" == "200" ] && pass "Network API GET /network/incidents: $STATUS" || fail "Network incidents: $STATUS"

  # Usage API
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    "$GW_URL/telecom/usage/v1/usage/SUB-001")
  [ "$STATUS" == "200" ] && pass "Usage API GET /usage/SUB-001: $STATUS" || fail "Usage API: $STATUS"

  # Usage API - summary
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    "$GW_URL/telecom/usage/v1/usage/summary?partnerId=mvno-a")
  [ "$STATUS" == "200" ] && pass "Usage API GET /usage/summary: $STATUS" || fail "Usage summary: $STATUS"
}

# ─── Test MI transformation header ───────────────────────────────────────────
test_mi_transformation() {
  local token=$1
  log "━━━━ Testing WSO2 MI transformation ━━━━"

  TRANSFORM_HEADER=$(curl -sk -I \
    -H "Authorization: Bearer $token" \
    "$GW_URL/telecom/plan/v1/plans" \
    | grep -i "x-transformed-by" | tr -d '\r')

  if echo "$TRANSFORM_HEADER" | grep -qi "WSO2-MI"; then
    pass "MI transformation header present: $TRANSFORM_HEADER"
  else
    warn "MI transformation header not found (may be configured differently)"
  fi
}

# ─── Print sample responses ──────────────────────────────────────────────────
print_sample_response() {
  local token=$1
  log "━━━━ Sample API Response ━━━━"

  echo ""
  echo "GET $GW_URL/telecom/plan/v1/plans?type=wholesale"
  curl -sk \
    -H "Authorization: Bearer $token" \
    "$GW_URL/telecom/plan/v1/plans?type=wholesale" | jq . 2>/dev/null || echo "(jq not available)"
  echo ""
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  Telecom API Marketplace — End-to-End Test Suite"
  echo "═══════════════════════════════════════════════════════"
  echo ""

  check_prereqs
  test_backends_direct

  # Only test gateway if credentials provided
  if [ -n "${CLIENT_ID:-}" ] && [ -n "${CLIENT_SECRET:-}" ]; then
    test_gateway_security
    get_token "$CLIENT_ID" "$CLIENT_SECRET"
    test_gateway_apis "$TOKEN"
    test_mi_transformation "$TOKEN"
    [ -z "$SMOKE_ONLY" ] && print_sample_response "$TOKEN"
  else
    log "Skipping gateway tests (set CLIENT_ID and CLIENT_SECRET env vars)"
    log "Example: CLIENT_ID=xxx CLIENT_SECRET=yyy ./scripts/test-flow.sh"
  fi

  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo -e "  Results: ${GREEN}$PASS passed${NC} · ${RED}$FAIL failed${NC}"
  echo "═══════════════════════════════════════════════════════"
  echo ""

  [ $FAIL -eq 0 ] && exit 0 || exit 1
}

main "$@"
