FROM alpine:3.19

# Install only the GCC/G++ toolchain (~200MB vs ~1.2GB for gcc:12)
RUN apk add --no-cache g++ gcc musl-dev make

RUN adduser -D runner
USER runner
WORKDIR /app
