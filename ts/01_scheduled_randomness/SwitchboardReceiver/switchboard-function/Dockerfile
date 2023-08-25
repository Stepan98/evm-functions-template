# syntax=docker/dockerfile:1.4
FROM switchboardlabs/sgx-function:main

# Copy the binary
WORKDIR /sgx

COPY --chown=root:root ./configs/app.manifest.template /sgx/app.manifest.template
COPY --chown=root:root ./configs/nodejs.manifest.template /sgx/nodejs.manifest.template
COPY ./dist/index.js ./nodejs/index.js

# Get the measurement from the enclave
RUN /get_measurement.sh --nodejs && \
    cat /measurement.txt

ENTRYPOINT ["bash", "/boot.sh", "--nodejs"]
