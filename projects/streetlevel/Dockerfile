# Build context is the workspace root (projects/streetlevel), because the API
# server is a workspace member and shares the routing packages with the client.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY server ./server

# The Expo client is a workspace member but contributes nothing to the API
# image, and its native toolchain is most of the install. Dropping it here keeps
# the server image small and its dependency surface honest.
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.workspaces=p.workspaces.filter(w=>w!=='mobile');fs.writeFileSync('package.json',JSON.stringify(p,null,2));" \
 && npm install --no-audit --no-fund --ignore-scripts

RUN npm run build --workspace=@streetlevel/shared \
 && npm run build --workspace=@streetlevel/data \
 && npm run build --workspace=@streetlevel/router \
 && npm run build --workspace=@streetlevel/shaper \
 && npm run build --workspace=@streetlevel/server

RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/server ./server

# The station graph is a build artefact the service cannot start without, so
# fail the image build rather than a request at 2am.
RUN test -s packages/data/generated/network.json

USER node
EXPOSE 8080
ENV PORT=8080 HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/main.js"]
