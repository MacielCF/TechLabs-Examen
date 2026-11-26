const dns = require('dns');
const mongoose = require('mongoose');

const FALLBACK_DNS = ['8.8.8.8', '1.1.1.1'];
const DEFAULT_URI = 'mongodb://localhost:27017/terri-quintel-astrology';

/**
 * Resolves the MongoDB connection string, in this order:
 *  1. MONGODB_URI (full connection string)
 *  2. DB_USER + DB_PASSWORD + DB_HOST (+ optional DB_NAME) -> MongoDB Atlas (mongodb+srv)
 *  3. Local MongoDB
 */
function getMongoUri() {
  const { MONGODB_URI, DB_USER, DB_PASSWORD, DB_HOST, DB_NAME } = process.env;

  if (MONGODB_URI) return MONGODB_URI;

  if (DB_USER || DB_PASSWORD || DB_HOST) {
    if (!DB_USER || !DB_PASSWORD || !DB_HOST) {
      throw new Error('DB_USER, DB_PASSWORD and DB_HOST must all be set in backend/.env (or use MONGODB_URI).');
    }
    const user = encodeURIComponent(DB_USER);
    const password = encodeURIComponent(DB_PASSWORD);
    const dbName = DB_NAME || 'terri-quintel-astrology';
    return `mongodb+srv://${user}:${password}@${DB_HOST}/${dbName}?retryWrites=true&w=majority`;
  }

  return DEFAULT_URI;
}

/** Hides the password when a URI has to be logged. */
function maskUri(uri) {
  return uri.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:****@');
}

function explain(error) {
  const msg = error.message || '';
  if (/bad auth|authentication failed/i.test(msg)) {
    return 'Wrong username or password. Check DB_USER / DB_PASSWORD (Atlas > Database Access).';
  }
  if (/querySrv/i.test(msg)) {
    return 'DNS could not resolve the cluster. Check DB_HOST, or set DNS_SERVERS=8.8.8.8,1.1.1.1 in backend/.env.';
  }
  if (/ENOTFOUND/i.test(msg)) {
    return 'Cluster address not found. Check DB_HOST (e.g. cluster0.xxxxx.mongodb.net).';
  }
  if (/IP.*whitelist|not authorized|Could not connect to any servers|ReplicaSetNoPrimary|timed out/i.test(msg)) {
    return 'Could not reach the cluster. In Atlas > Network Access, add your current IP address.';
  }
  if (/ECONNREFUSED/i.test(msg)) {
    return 'Connection refused. Is MongoDB running locally?';
  }
  return null;
}

const isSrvLookupError = error => /querySrv/i.test(error.message || '');

/** Applies custom DNS servers from DNS_SERVERS (comma-separated), if set. */
function applyDnsServersFromEnv() {
  const servers = (process.env.DNS_SERVERS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (servers.length) dns.setServers(servers);
}

const connectDB = async () => {
  let uri;
  try {
    applyDnsServersFromEnv();
    uri = getMongoUri();
    const options = { serverSelectionTimeoutMS: 10000 };

    let conn;
    try {
      conn = await mongoose.connect(uri, options);
    } catch (error) {
      // Some Windows setups (VPNs, local DNS filters) make Node's resolver fail on SRV lookups
      // even though the system resolver works. Retry once with public DNS servers.
      if (!isSrvLookupError(error) || process.env.DNS_SERVERS) throw error;
      console.warn(`SRV DNS lookup failed (${error.message}). Retrying with public DNS ${FALLBACK_DNS.join(', ')}...`);
      dns.setServers(FALLBACK_DNS);
      conn = await mongoose.connect(uri, options);
    }

    console.log(`MongoDB Connected: ${conn.connection.host} (db: ${conn.connection.name})`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    if (uri) console.error(`URI: ${maskUri(uri)}`);
    const hint = explain(error);
    if (hint) console.error(`Hint: ${hint}`);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.getMongoUri = getMongoUri;
module.exports.maskUri = maskUri;
