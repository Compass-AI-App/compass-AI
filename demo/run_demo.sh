#!/bin/bash
# Compass Demo — SyncFlow product discovery
#
# This demonstrates the full Compass product discovery loop:
# 1. Initialize a product workspace
# 2. Connect evidence sources (code, docs, data, interviews, support)
# 3. Ingest all evidence
# 4. Reconcile sources (find conflicts)
# 5. Discover opportunities ("what should we build next?")
# 6. Generate a feature spec (agent-ready)
#
# Prerequisites:
#   - ANTHROPIC_API_KEY set in environment
#   - compass installed (pip install -e .)
#
# Usage:
#   cd demo && bash run_demo.sh

set -e

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="$DEMO_DIR/workspace"

echo "=== Compass Demo: SyncFlow Product Discovery ==="
echo ""

# Clean previous demo
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Step 1: Initialize
echo "--- Step 1: Initialize workspace ---"
compass init "SyncFlow" -d "Real-time sync platform for teams"
echo ""

# Step 2: Connect sources
echo "--- Step 2: Connect evidence sources ---"
compass connect github --path "$DEMO_DIR/sample_data/code" --name "syncflow-codebase"
compass connect docs --path "$DEMO_DIR/sample_data/strategy" --name "product-strategy"
compass connect analytics --path "$DEMO_DIR/sample_data/analytics" --name "usage-metrics"
compass connect interviews --path "$DEMO_DIR/sample_data/interviews" --name "customer-interviews"
compass connect support --path "$DEMO_DIR/sample_data/support" --name "support-tickets"
echo ""

# Step 3: Ingest
echo "--- Step 3: Ingest evidence ---"
compass ingest
echo ""

# Step 4: Reconcile
echo "--- Step 4: Reconcile sources ---"
compass reconcile
echo ""

# Step 5: Discover
echo "--- Step 5: Discover opportunities ---"
compass discover
echo ""

echo "=== Demo complete ==="
echo ""
echo "To generate a feature spec, run:"
echo "  cd $WORK_DIR && compass specify \"<opportunity title>\""
echo ""
echo "Outputs are in: $WORK_DIR/.compass/output/"
