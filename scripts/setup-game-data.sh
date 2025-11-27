#!/bin/bash
# Quick script to generate all game data files

set -e  # Exit on error

echo "================================"
echo "Generating Game Data Files"
echo "================================"
echo ""

cd "$(dirname "$0")/../data"

echo "📊 Generating movement data..."
python3 fix_all_movements.py
echo ""

echo "📊 Generating remaining game files..."
python3 process_remaining_files.py
echo ""

echo "🎴 Converting card data..."
python3 convert_cards_expanded.py
echo ""

cd ..

echo "================================"
echo "✅ Data Generation Complete!"
echo "================================"
echo ""
echo "Generated files in: public/data/CLEAN_FILES/"
ls -lh public/data/CLEAN_FILES/
echo ""
echo "Next steps:"
echo "1. Restart your dev server (npm run dev)"
echo "2. Hard refresh browser (Ctrl+Shift+R)"
echo "3. Test movement through game"
