# syntax=docker/dockerfile:1.4
FROM switchboardlabs/gramine

# Create directory structure, fn will be at /sgx/nodejs/index.js
RUN mkdir -p /sgx/nodejs

# Copy the build artifacts
COPY ./dist/index.js/ /sgx/nodejs/index.js

# Copy the SGX configs
WORKDIR /sgx
COPY ./configs/boot.sh /boot.sh
RUN chmod +x /boot.sh
COPY ./configs/nodejs.manifest.template ./nodejs.manifest.template
COPY ./configs/sgx_default_qcnl.conf /etc/sgx_default_qcnl.conf
COPY ./configs/get_measurement.sh ./measurement.sh


# Setup Gramine & Measurement
RUN gramine-sgx-gen-private-key
RUN gramine-manifest nodejs.manifest.template > nodejs.manifest
RUN gramine-sgx-sign --manifest nodejs.manifest --output nodejs.manifest.sgx | tee /out.txt
RUN echo "0x$(cat /out.txt | tail -1 | sed -e "s/^[[:space:]]*//")" | tee /measurement.txt

CMD ["bash", "/boot.sh", "--nodejs"]
