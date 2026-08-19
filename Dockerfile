# ShortsCraft — production image
#
# Built as a container rather than a plain Node service because the export
# pipeline shells out to two things a stock Node host does not have:
#   * ffmpeg — frames are piped into it to make the MP4
#   * Chromium — puppeteer renders and frame-steps the animation
# Fonts matter too: the templates lean on emoji and on a clean sans, and a bare
# container renders both as blank boxes in the exported video.

FROM node:22-bookworm-slim

# Both skip flags: puppeteer renamed the variable at v22 and still reads the
# old one, so setting each keeps the image from pulling a second Chrome.
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ffmpeg \
      # Chromium's runtime libraries
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2 libpango-1.0-0 libcairo2 \
      # text in exported frames: a sans, a serif, mono, and colour emoji
      fonts-liberation fonts-dejavu-core fonts-noto-core fonts-noto-color-emoji \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first so an application-only change reuses this layer.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# State lives on a mounted volume, not in the image — every module already
# takes its path from an environment variable, so nothing in the code changes.
ENV USERS_FILE=/data/users.json \
    CREDITS_FILE=/data/credits.json \
    WAITLIST_FILE=/data/waitlist.json \
    COMMUNITY_FILE=/data/community.json \
    COMMENTS_FILE=/data/comments.json

RUN mkdir -p /data

EXPOSE 3000
CMD ["node", "server.js"]
