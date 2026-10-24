#!/bin/bash
# Auto MCP Indexer for Bike Rider Documentation
# This script generates a unified index of all project documentation for the codebase-memory-mcp.

OUTPUT="mcp-index.md"
DOCS=("Brain.md" "PRD.md" "TRD.md" "Architecture.md" "app flow.md" "backend scema.md" "UI-UX Design Brief.md" "Design.md" "open graph tags.md" "Phases.md" "Task.md" "Implementation Plan.md" "Rules.md" "security.md" "licence.md" "Memory.md" "redesign.md" "PUBLISH.md" "APPGALLERY-RUNBOOK.md" "llms.txt")

echo "# BIKE RIDER - MCP Documentation Index" > "$OUTPUT"
echo "Generated on $(date)" >> "$OUTPUT"
echo "" >> "$OUTPUT"

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo "## $doc" >> "$OUTPUT"
        # Extract the first few lines or the first heading as a summary
        head -n 10 "$doc" | grep -v "^#" | grep -v "^$" | head -n 3 >> "$OUTPUT"
        echo "" >> "$OUTPUT"
        # encode spaces so markdown links stay valid for filenames like "open graph tags.md"
        echo "[View full file](./${doc// /%20})" >> "$OUTPUT"
        echo "" >> "$OUTPUT"
    else
        echo "Warning: $doc not found"
    fi
done

echo "MCP index generated at $OUTPUT"
