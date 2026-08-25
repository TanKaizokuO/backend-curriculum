// The TypeScript twin of Code/Lesson_15_code/tls_proxy.py — a reverse
// proxy that terminates TLS by hand, before naming Nginx. Same three jobs:
//
// 1. Terminate TLS. The client's TLS session ends here; the hop to
//    origin.ts is plain HTTP.
// 2. Pick a certificate by SNI, via Node's own `SNICallback` — the same
//    hook a real proxy uses, just called from a script instead of a
//    config file.
// 3. Add forwarding headers, and reject an over-size body before it
//    reaches the origin.
//
//   ./generate-certs.sh                # once, from this directory
//   node src/tlsProxy.ts               # listens on 127.0.0.1:8443

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

const LISTEN_HOST = "127.0.0.1";
const LISTEN_PORT = 8443;
const ORIGIN_HOST = "127.0.0.1";
const ORIGIN_PORT = 8030;
const MAX_BODY_BYTES = 1024; // 1 KiB, small on purpose

const CERT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "certs");
const hostnames = fs
  .readdirSync(CERT_DIR)
  .filter((f) => f.endsWith(".crt"))
  .map((f) => f.replace(/\.crt$/, ""))
  .sort();
const contexts = new Map<string, tls.SecureContext>(
  hostnames.map((name) => [
    name,
    tls.createSecureContext({
      cert: fs.readFileSync(path.join(CERT_DIR, `${name}.crt`)),
      key: fs.readFileSync(path.join(CERT_DIR, `${name}.key`)),
    }),
  ]),
);
const defaultHostname = hostnames[0]!;

function contentLength(head: string): number {
  for (const line of head.split("\r\n").slice(1)) {
    const [name, ...rest] = line.split(":");
    if (name?.trim().toLowerCase() === "content-length") {
      return Number(rest.join(":").trim());
    }
  }
  return 0;
}

const server = tls.createServer(
  {
    SNICallback: (servername, callback) => {
      const matched = contexts.has(servername);
      const served = matched ? servername : defaultHostname;
      console.log(
        `tls_proxy: SNI asked for ${JSON.stringify(servername)} -> serving cert for ` +
          `${JSON.stringify(served)}${matched ? "" : " (no exact match, served the default)"}`,
      );
      callback(null, contexts.get(served)!);
    },
    cert: fs.readFileSync(path.join(CERT_DIR, `${defaultHostname}.crt`)),
    key: fs.readFileSync(path.join(CERT_DIR, `${defaultHostname}.key`)),
  },
  (clientSocket) => {
    const clientAddr = clientSocket.remoteAddress ?? "unknown";
    let buf = Buffer.alloc(0);
    let headParsed = false;

    const onData = (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      if (headParsed) return;
      const sep = buf.indexOf("\r\n\r\n");
      if (sep === -1) return;
      headParsed = true;
      clientSocket.pause();

      const head = buf.subarray(0, sep).toString("latin1");
      const already = buf.subarray(sep + 4);
      const requestLine = head.split("\r\n")[0] ?? "";
      const length = contentLength(head);

      if (length > MAX_BODY_BYTES) {
        console.log(
          `tls_proxy: ${requestLine} -> 413 (Content-Length ${length} > ${MAX_BODY_BYTES})`,
        );
        const body = "request body too large\n";
        clientSocket.end(
          `HTTP/1.1 413 Content Too Large\r\nContent-Length: ${body.length}\r\n` +
            `Connection: close\r\n\r\n${body}`,
        );
        return;
      }

      const finishForwarding = (body: Buffer) => {
        const lines = head.split("\r\n");
        const headers = lines
          .slice(1)
          .filter((l) => !/^x-forwarded-(for|proto):/i.test(l));
        headers.push(`X-Forwarded-For: ${clientAddr}`);
        headers.push("X-Forwarded-Proto: https");
        const forwarded = Buffer.concat([
          Buffer.from(lines[0] + "\r\n" + headers.join("\r\n") + "\r\n\r\n", "latin1"),
          body,
        ]);

        console.log(
          `tls_proxy: ${requestLine} from ${clientAddr} -> ${ORIGIN_HOST}:${ORIGIN_PORT} ` +
            "(added X-Forwarded-For, X-Forwarded-Proto)",
        );

        const originSocket = net.connect(ORIGIN_PORT, ORIGIN_HOST, () => {
          originSocket.write(forwarded);
        });
        originSocket.on("data", (respChunk) => clientSocket.write(respChunk));
        originSocket.on("end", () => clientSocket.end());
        originSocket.on("error", (err) => {
          console.log(`tls_proxy: origin connection failed: ${err.message}`);
          clientSocket.destroy();
        });
      };

      if (already.length >= length) {
        finishForwarding(already.subarray(0, length));
        clientSocket.resume();
      } else {
        let body = already;
        const onBody = (moreChunk: Buffer) => {
          body = Buffer.concat([body, moreChunk]);
          if (body.length >= length) {
            clientSocket.off("data", onBody);
            finishForwarding(body.subarray(0, length));
          }
        };
        clientSocket.on("data", onBody);
        clientSocket.resume();
      }
    };

    clientSocket.setTimeout(5000, () => clientSocket.destroy());
    clientSocket.on("data", onData);
    clientSocket.on("error", (err) => {
      console.log(`tls_proxy: connection from ${clientAddr} failed: ${err.message}`);
    });
  },
);

server.on("tlsClientError", (err) => {
  console.log(`tls_proxy: handshake failed: ${err.message}`);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(
    `tls_proxy listening on https://${LISTEN_HOST}:${LISTEN_PORT} ` +
      `(certs for: ${hostnames.join(", ")}) -> http://${ORIGIN_HOST}:${ORIGIN_PORT}`,
  );
});
