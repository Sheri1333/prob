import dns from "node:dns";
import net from "node:net";
import tls from "node:tls";

dns.setDefaultResultOrder("ipv4first");

// Node 22.20+ defaults to X25519MLKEM768; Atlas answers with TLS alert 80.
tls.DEFAULT_ECDH_CURVE = "X25519:P-256:P-384:P-521";
if (typeof net.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false);
}

