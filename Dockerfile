# syntax=docker/dockerfile:1.4
FROM switchboardlabs/sgx-function AS builder

ARG CARGO_NAME=switchboard-function

WORKDIR /home/root/switchboard-function
COPY . .

RUN  --mount=type=cache,target=/usr/local/cargo/registry --mount=type=cache,target=/home/root/switchboard-function/target \
    cargo build --release && \
    cargo strip && \
    mv target/release/${CARGO_NAME} /sgx/app

FROM switchboardlabs/sgx-function
ARG CARGO_NAME=switchboard-function

# Copy the binary
COPY --from=builder /sgx/app /sgx

# Get the measurement from the enclave
RUN /get_measurement.sh
RUN gramine-manifest /app.manifest.template > app.manifest
RUN gramine-sgx-sign --manifest app.manifest --output app.manifest.sgx | tail -2 | tee /measurement.txt

ENTRYPOINT ["/bin/bash", "/boot.sh"]