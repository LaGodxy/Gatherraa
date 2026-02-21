#!/bin/bash

# Escrow Contract Deployment Script
# Usage: ./deploy.sh [network] [source_account]

set -e

NETWORK="${1:-futurenet}"
SOURCE_ACCOUNT="${2:-your-account}"

echo "🚀 Deploying Escrow Contract to $NETWORK"
echo "Source Account: $SOURCE_ACCOUNT"
echo "======================================"

# Build the contract
echo "🏗️  Building contract..."
cargo build --target wasm32-unknown-unknown --release

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful"

# Deploy to network
echo "📡 Deploying to $NETWORK..."
CONTRACT_ID=$(soroban contract deploy \
    --wasm target/wasm32-unknown-unknown/release/escrow_contract.wasm \
    --source $SOURCE_ACCOUNT \
    --network $NETWORK)

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    exit 1
fi

echo "✅ Contract deployed successfully!"
echo "Contract ID: $CONTRACT_ID"

# Initialize the contract
echo "⚙️  Initializing contract..."
ADMIN_ADDRESS=$(soroban config identity address $SOURCE_ACCOUNT)
EMERGENCY_ADMIN_ADDRESS=$ADMIN_ADDRESS  # In production, use different account

soroban contract invoke \
    --id $CONTRACT_ID \
    --source $SOURCE_ACCOUNT \
    --network $NETWORK \
    -- \
    initialize \
    --admin "$ADMIN_ADDRESS" \
    --emergency_admin "$EMERGENCY_ADMIN_ADDRESS"

if [ $? -ne 0 ]; then
    echo "❌ Initialization failed!"
    exit 1
fi

echo "✅ Contract initialized successfully!"

# Test basic functionality
echo "🧪 Testing basic functionality..."

# Get platform fee
PLATFORM_FEE=$(soroban contract invoke \
    --id $CONTRACT_ID \
    --source $SOURCE_ACCOUNT \
    --network $NETWORK \
    -- \
    get_platform_fee_bps)

echo "Platform fee: $PLATFORM_FEE basis points"

# Get total escrows (should be 0)
TOTAL_ESCROWS=$(soroban contract invoke \
    --id $CONTRACT_ID \
    --source $SOURCE_ACCOUNT \
    --network $NETWORK \
    -- \
    get_total_escrows)

echo "Total escrows: $TOTAL_ESCROWS"

echo "======================================"
echo "🎉 Deployment completed successfully!"
echo "Contract ID: $CONTRACT_ID"
echo "Network: $NETWORK"
echo "Admin: $ADMIN_ADDRESS"
echo "======================================"

# Save contract info
cat > deployed_contract.json << EOF
{
  "contract_id": "$CONTRACT_ID",
  "network": "$NETWORK",
  "admin": "$ADMIN_ADDRESS",
  "emergency_admin": "$EMERGENCY_ADMIN_ADDRESS",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platform_fee_bps": $PLATFORM_FEE
}
EOF

echo "Contract info saved to deployed_contract.json"