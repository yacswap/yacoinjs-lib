'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bcrypto = require('../crypto');
const networks_1 = require('../networks');
const bscript = require('../script');
const lazy = require('./lazy');
const bs58check = require('bs58check');
const typef = require('typeforce');
const OPS = bscript.OPS;
const ecc = require('tiny-secp256k1');
// input: {signature}
// output: {pubKey} OP_CHECKSIG
function p2pk(a, opts) {
  if (!a.input && !a.output && !a.pubkey && !a.input && !a.signature)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  typef(
    {
      network: typef.maybe(typef.Object),
      address: typef.maybe(typef.String),
      hash: typef.maybe(typef.BufferN(20)),
      output: typef.maybe(typef.Buffer),
      pubkey: typef.maybe(ecc.isPoint),
      signature: typef.maybe(bscript.isCanonicalScriptSignature),
      input: typef.maybe(typef.Buffer),
    },
    a,
  );
  const _address = lazy.value(() => {
    const payload = bs58check.decode(a.address);
    const version = payload.readUInt8(0);
    const hash = payload.slice(1);
    return { version, hash };
  });
  const _chunks = lazy.value(() => {
    return bscript.decompile(a.input);
  });
  const network = a.network || networks_1.yacoin;
  const o = { name: 'p2pk', network };
  lazy.prop(o, 'hash', () => {
    if (a.address) return _address().hash;
    if (a.pubkey || o.pubkey) return bcrypto.hash160(a.pubkey || o.pubkey);
  });
  lazy.prop(o, 'address', () => {
    if (!o.hash) return;
    const payload = Buffer.allocUnsafe(21);
    payload.writeUInt8(network.pubKeyHash, 0);
    o.hash.copy(payload, 1);
    return bs58check.encode(payload);
  });
  lazy.prop(o, 'output', () => {
    if (!a.pubkey) return;
    return bscript.compile([a.pubkey, OPS.OP_CHECKSIG]);
  });
  lazy.prop(o, 'pubkey', () => {
    if (!a.output) return;
    return a.output.slice(1, -1);
  });
  lazy.prop(o, 'signature', () => {
    if (!a.input) return;
    return _chunks()[0];
  });
  lazy.prop(o, 'input', () => {
    if (!a.signature) return;
    return bscript.compile([a.signature]);
  });
  lazy.prop(o, 'witness', () => {
    if (!o.input) return;
    return [];
  });
  // extended validation
  if (opts.validate) {
    if (a.output) {
      if (a.output[a.output.length - 1] !== OPS.OP_CHECKSIG)
        throw new TypeError('Output is invalid');
      if (!ecc.isPoint(o.pubkey))
        throw new TypeError('Output pubkey is invalid');
      if (a.pubkey && !a.pubkey.equals(o.pubkey))
        throw new TypeError('Pubkey mismatch');
    }
    if (a.signature) {
      if (a.input && !a.input.equals(o.input))
        throw new TypeError('Signature mismatch');
    }
    if (a.input) {
      if (_chunks().length !== 1) throw new TypeError('Input is invalid');
      if (!bscript.isCanonicalScriptSignature(o.signature))
        throw new TypeError('Input has invalid signature');
    }
  }
  return Object.assign(o, a);
}
exports.p2pk = p2pk;
