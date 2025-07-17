npx jco transpile target/wasm32-wasip1/release/rust_controller.wasm -o ./js --no-typescript --no-nodejs-compat

cargo component build --release
