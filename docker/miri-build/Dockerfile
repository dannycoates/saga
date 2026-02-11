FROM debian:bookworm-slim

# Build tools needed for compiling the Rust toolchain
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

# Install cross-compilation toolchain for x86_64 if building on arm64
RUN if [ "$(dpkg --print-architecture)" != "amd64" ]; then \
    apt-get update && apt-get install -y \
        gcc-x86-64-linux-gnu \
        g++-x86-64-linux-gnu \
    && rm -rf /var/lib/apt/lists/*; \
    fi

# Install Rust nightly toolchain (needed for bootstrapping)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --default-toolchain nightly
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /build

# Shallow clone bjorn3's Rust fork
RUN git clone --depth=1 --branch compile_rustc_for_wasm17 \
    https://github.com/bjorn3/rust.git

# Copy the build script and the pre-build script separately
# so changes to post-LLVM patches don't invalidate the LLVM cache
COPY pre-build.sh /build/pre-build.sh
RUN chmod +x /build/pre-build.sh && /build/pre-build.sh

COPY build.sh /build/build.sh
RUN chmod +x /build/build.sh && /build/build.sh
