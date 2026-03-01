FROM eclipse-temurin:17-jdk-alpine

# Pre-generate the Class Data Sharing (CDS) archive so every `java` invocation
# can memory-map standard-library metadata instead of parsing it from scratch.
# This shaves ~200-400ms off JVM startup.
RUN java -Xshare:dump 2>/dev/null || true

RUN adduser -D runner
USER runner
WORKDIR /app
