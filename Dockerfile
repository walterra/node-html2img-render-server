FROM node:18-slim

# Install required dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libwoff1 \
    libopus0 \
    libwebp6 \
    libwebpdemux2 \
    libenchant1c2a \
    libgudev-1.0-0 \
    libsecret-1-0 \
    libhyphen0 \
    libgdk-pixbuf2.0-0 \
    libegl1 \
    libnotify4 \
    libxslt1.1 \
    libevent-2.1-7 \
    libgles2 \
    libvpx6 \
    libxcomposite1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libepoxy0 \
    libgtk-3-0 \
    libharfbuzz-icu0 \
    libgstreamer-gl1.0-0 \
    libgstreamer-plugins-bad1.0-0 \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    libjpeg62-turbo \
    libpangocairo-1.0-0 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libpango-1.0-0 \
    libnspr4 \
    libnss3 \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    xauth \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install app dependencies
COPY package.json yarn.lock* ./
RUN yarn --frozen-lockfile --production

# Install Playwright browsers
RUN yarn playwright install chromium

# Copy app source
COPY . .

# Create screenshots directory
RUN mkdir -p public/screenshots && chmod -R 755 public/screenshots

# Expose port
EXPOSE 3000

# Set NODE_ENV to production
ENV NODE_ENV=production

# Run as non-root user for better security
RUN groupadd -r renderuser && useradd -r -g renderuser -G audio,video renderuser \
    && chown -R renderuser:renderuser /app
USER renderuser

# Start the server
CMD ["node", "server.js"]