#!/bin/bash
set -e

# Build the js_of_ocaml toplevel for Elevator Saga
# Requires: opam with ocaml 5.x, dune 3.0+

BUILD_DIR="ocaml-toplevel"
OUTPUT_DIR="public/ocaml"

echo "Building OCaml toplevel..."

# Check for opam
if ! command -v opam &> /dev/null; then
    echo "Error: opam is required but not installed."
    echo "Install opam from https://opam.ocaml.org/doc/Install.html"
    exit 1
fi

# Ensure opam is initialized
eval $(opam env 2>/dev/null || true)

# Install dependencies if needed
echo "Installing OCaml dependencies..."
opam install -y dune js_of_ocaml js_of_ocaml-compiler js_of_ocaml-toplevel js_of_ocaml-ppx

# Build the toplevel (dune handles the js_of_ocaml compilation)
echo "Compiling toplevel to JavaScript..."
cd "$BUILD_DIR"
dune clean
dune build toplevel.bc.js

# Copy output
echo "Copying to $OUTPUT_DIR..."
mkdir -p "../$OUTPUT_DIR"
cp _build/default/toplevel.bc.js "../$OUTPUT_DIR/toplevel.unmin.js"

cd ..

# Minify with esbuild (reduces ~29MB to ~9MB)
echo "Minifying with esbuild..."
if command -v npx &> /dev/null; then
    npx esbuild "$OUTPUT_DIR/toplevel.unmin.js" --minify --outfile="$OUTPUT_DIR/toplevel.js"
    rm -f "$OUTPUT_DIR/toplevel.unmin.js"
else
    echo "Warning: npx not found, skipping minification"
    mv "$OUTPUT_DIR/toplevel.unmin.js" "$OUTPUT_DIR/toplevel.js"
fi

echo "Done! Output in $OUTPUT_DIR/"
echo "File size: $(du -h "$OUTPUT_DIR/toplevel.js" | cut -f1)"
