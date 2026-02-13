FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    clang \
    cmake \
    curl \
    git \
    libssl-dev \
    ninja-build \
    nodejs \
    pkg-config \
    python3 \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Install the exact stage0 compiler that Rust 1.93 expects (from src/stage0)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --default-toolchain 1.92.0
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /build

# Clone Rust 1.93.0 stable release
RUN git clone --depth=1 --branch 1.93.0 https://github.com/rust-lang/rust.git

# Pre-build: config + WASI SDK + LLVM (cached layer)
COPY pre-build.sh /build/pre-build.sh
RUN chmod +x /build/pre-build.sh && /build/pre-build.sh

# Miri patches + build (fast iteration layer)
COPY build.sh /build/build.sh
RUN chmod +x /build/build.sh && /build/build.sh
