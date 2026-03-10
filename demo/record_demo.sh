#!/bin/bash
# Record a terminal demo of Compass using asciinema
#
# Prerequisites:
#   - asciinema installed: pip install asciinema  (or brew install asciinema)
#   - ANTHROPIC_API_KEY set in environment
#   - compass installed: cd engine && pip install -e .
#
# Usage:
#   cd demo && bash record_demo.sh
#
# Output:
#   demo/compass-demo.cast (asciicast v2 format)
#
# To convert to GIF (for README):
#   pip install agg   # asciinema gif generator
#   agg compass-demo.cast compass-demo.gif --cols 100 --rows 35 --speed 2
#
# Or use svg-term-cli for SVG:
#   npx svg-term-cli --in compass-demo.cast --out compass-demo.svg --window --width 100

set -e

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$DEMO_DIR/compass-demo.cast"

if ! command -v asciinema &> /dev/null; then
    echo "asciinema not found. Install with: pip install asciinema"
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "ANTHROPIC_API_KEY not set. Export it before recording."
    exit 1
fi

echo "Recording demo to $OUTPUT..."
echo "The demo will run 'compass demo --skip-spec' automatically."
echo ""

# Record the demo command
asciinema rec "$OUTPUT" \
    --cols 100 \
    --rows 35 \
    --title "Compass — Cursor for Product Managers" \
    --command "compass demo --skip-spec" \
    --overwrite

echo ""
echo "Recording saved to: $OUTPUT"
echo ""
echo "To convert to GIF:"
echo "  pip install agg && agg $OUTPUT ${OUTPUT%.cast}.gif --speed 2"
echo ""
echo "To convert to SVG:"
echo "  npx svg-term-cli --in $OUTPUT --out ${OUTPUT%.cast}.svg --window"
