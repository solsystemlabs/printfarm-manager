#!/usr/bin/env bash
#
# Smoke Test Script for Print Farm Manager
#
# Usage:
#   ./scripts/smoke-test.sh <environment> <base-url>
#
# Examples:
#   ./scripts/smoke-test.sh staging https://pm-staging.solsystemlabs.com
#   ./scripts/smoke-test.sh production https://pm.solsystemlabs.com
#   ./scripts/smoke-test.sh staging https://feature-branch-pm-staging.example.workers.dev
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
#   2 - Invalid usage

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Usage
usage() {
    echo "Usage: $0 <environment> <base-url>"
    echo ""
    echo "Arguments:"
    echo "  environment  Target environment (development|staging|production)"
    echo "  base-url     Base URL of the deployed application (without trailing slash)"
    echo ""
    echo "Examples:"
    echo "  $0 staging https://pm-staging.solsystemlabs.com"
    echo "  $0 production https://pm.solsystemlabs.com"
    echo "  $0 staging https://feature-branch-pm-staging.example.workers.dev"
    exit 2
}

# Validate arguments
if [ $# -ne 2 ]; then
    usage
fi

ENVIRONMENT="$1"
BASE_URL="${2%/}" # Remove trailing slash if present

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    echo -e "${RED}Error: Environment must be 'development', 'staging', or 'production'${NC}"
    usage
fi

# Validate base URL format
if [[ ! "$BASE_URL" =~ ^https?:// ]]; then
    echo -e "${RED}Error: Base URL must start with http:// or https://${NC}"
    usage
fi

# Print header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Print Farm Manager - Smoke Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Base URL:    ${YELLOW}$BASE_URL${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_function="$2"

    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "Testing: $test_name ... "

    if $test_function; then
        echo -e "${GREEN}PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Helper function to make HTTP requests with error handling
http_get() {
    local url="$1"
    local response
    local http_code

    # Make request and capture both body and HTTP status code
    response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Export for test functions to use
    export HTTP_CODE="$http_code"
    export HTTP_BODY="$body"

    # Return success if HTTP code is 2xx
    [[ "$http_code" =~ ^2[0-9][0-9]$ ]]
}

# Test 1: Health check endpoint
test_health_check() {
    if ! http_get "$BASE_URL/api/health"; then
        echo -e "  ${RED}HTTP Status: $HTTP_CODE${NC}" >&2
        return 1
    fi

    # Parse JSON response
    local status=$(echo "$HTTP_BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

    if [ "$status" != "healthy" ]; then
        echo -e "  ${RED}Expected status 'healthy', got '$status'${NC}" >&2
        return 1
    fi

    return 0
}

# Test 2: Environment configuration
test_environment_config() {
    if ! http_get "$BASE_URL/api/health"; then
        echo -e "  ${RED}HTTP Status: $HTTP_CODE${NC}" >&2
        return 1
    fi

    # Parse environment from response
    local env=$(echo "$HTTP_BODY" | grep -o '"environment":"[^"]*"' | cut -d'"' -f4)

    # For preview URLs (workers.dev), accept staging environment
    if [[ "$BASE_URL" =~ workers\.dev ]]; then
        if [ "$env" != "staging" ]; then
            echo -e "  ${RED}Preview URL should have environment 'staging', got '$env'${NC}" >&2
            return 1
        fi
    else
        # For custom domains, verify exact environment match
        if [ "$env" != "$ENVIRONMENT" ]; then
            echo -e "  ${RED}Expected environment '$ENVIRONMENT', got '$env'${NC}" >&2
            return 1
        fi
    fi

    return 0
}

# Test 3: Database configuration check
test_database_config() {
    if ! http_get "$BASE_URL/api/health"; then
        echo -e "  ${RED}HTTP Status: $HTTP_CODE${NC}" >&2
        return 1
    fi

    # Parse database status from response
    local db_status=$(echo "$HTTP_BODY" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)

    # Database should be configured in staging and production
    if [ "$ENVIRONMENT" != "development" ]; then
        if [ "$db_status" != "configured" ]; then
            echo -e "  ${RED}Database should be configured in $ENVIRONMENT, got '$db_status'${NC}" >&2
            return 1
        fi
    fi

    return 0
}

# Test 4: R2 storage operations (dev/staging only)
test_r2_operations() {
    # Skip R2 tests for production (safety measure)
    if [ "$ENVIRONMENT" = "production" ]; then
        echo -e "  ${YELLOW}Skipped (not run in production)${NC}"
        return 0
    fi

    if ! http_get "$BASE_URL/api/test-r2"; then
        # Check if R2 is just not configured yet (not a failure)
        if echo "$HTTP_BODY" | grep -q "binding not available"; then
            echo -e "  ${YELLOW}R2 not configured (optional)${NC}" >&2
            return 0
        fi
        echo -e "  ${RED}HTTP Status: $HTTP_CODE${NC}" >&2
        echo -e "  ${RED}Response: $HTTP_BODY${NC}" >&2
        return 1
    fi

    # Parse success status from response
    local success=$(echo "$HTTP_BODY" | grep -o '"success":[^,}]*' | cut -d':' -f2)

    if [ "$success" != "true" ]; then
        echo -e "  ${RED}R2 operations failed${NC}" >&2
        echo -e "  ${RED}Response: $HTTP_BODY${NC}" >&2
        return 1
    fi

    return 0
}

# Test 5: Homepage loads
test_homepage() {
    if ! http_get "$BASE_URL/"; then
        echo -e "  ${RED}HTTP Status: $HTTP_CODE${NC}" >&2
        return 1
    fi

    # Check that we got HTML content
    if ! echo "$HTTP_BODY" | grep -q "<html"; then
        echo -e "  ${RED}Expected HTML response${NC}" >&2
        return 1
    fi

    return 0
}

# Test 6: Response time check
test_response_time() {
    local start_time=$(date +%s%N)

    if ! http_get "$BASE_URL/api/health"; then
        echo -e "  ${RED}HTTP Status: $HTTP_CODE${NC}" >&2
        return 1
    fi

    local end_time=$(date +%s%N)
    local duration_ms=$(( (end_time - start_time) / 1000000 ))

    # Warn if response time > 2 seconds (edge workers should be fast)
    if [ $duration_ms -gt 2000 ]; then
        echo -e "  ${YELLOW}Response time: ${duration_ms}ms (slower than expected)${NC}" >&2
    fi

    # Fail if response time > 5 seconds
    if [ $duration_ms -gt 5000 ]; then
        echo -e "  ${RED}Response time: ${duration_ms}ms (too slow)${NC}" >&2
        return 1
    fi

    return 0
}

# Run all tests
echo -e "${BLUE}Running tests...${NC}"
echo ""

run_test "Health check endpoint" test_health_check
run_test "Environment configuration" test_environment_config
run_test "Database configuration" test_database_config
run_test "R2 storage operations" test_r2_operations
run_test "Homepage loads" test_homepage
run_test "Response time" test_response_time

# Print summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Tests run:    $TESTS_RUN"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo -e "${BLUE}========================================${NC}"

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
