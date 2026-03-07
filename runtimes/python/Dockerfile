FROM python:3.12-slim AS base

# Install pip packages using prebuilt wheels (no compilation needed)
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    ipykernel \
    pillow \
    scikit-learn \
    && rm -rf /root/.cache/pip /tmp/*

# Create non-root user
RUN useradd -m runner
USER runner
WORKDIR /app