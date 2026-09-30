import { get, set } from 'idb-keyval';
import sodium from 'libsodium-wrappers';

/**
 * Initialize libsodium and generate a Curve25519 key pair for the user.
 * The private key is stored encrypted in IndexedDB, the public key is saved
 * in Firestore under `users/{uid}.e2ePublicKey`.
 */
export async function initUserKeys(uid: string, db: any) {
  await sodium.ready;
  const keyPair = sodium.crypto_kx_keypair();
  // Store private key locally (in IndexedDB)
  await set('e2ee_private_key', sodium.to_hex(keyPair.privateKey));
  // Save public key to Firestore (plain hex string)
  await db.collection('users').doc(uid).set(
    { e2ePublicKey: sodium.to_hex(keyPair.publicKey) },
    { merge: true }
  );
}

/** Retrieve the stored private key from IndexedDB */
export async function getPrivateKey(): Promise<Uint8Array | null> {
  const hex = await get('e2ee_private_key') as string | undefined;
  if (!hex) return null;
  return sodium.from_hex(hex);
}

/** Get a user's public key from Firestore */
export async function getPublicKey(uid: string, db: any): Promise<Uint8Array | null> {
  const docSnap = await db.collection('users').doc(uid).get();
  if (!docSnap.exists) return null;
  const data = docSnap.data();
  if (!data?.e2ePublicKey) return null;
  return sodium.from_hex(data.e2ePublicKey);
}

/** Encrypt a plaintext message for a recipient using XChaCha20-Poly1305 */
export async function encryptMessage(
  plaintext: string,
  recipientPublicKeyHex: string
): Promise<string> {
  await sodium.ready;
  const recipientPk = sodium.from_hex(recipientPublicKeyHex);
  const privateKey = await getPrivateKey();
  if (!privateKey) throw new Error('Private key not available');
  // Derive shared secret
  const sharedSecret = sodium.crypto_scalarmult(privateKey, recipientPk);
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    sodium.from_string(plaintext),
    null,
    null,
    nonce,
    sharedSecret
  );
  // Return hex representation of nonce + ciphertext
  return sodium.to_hex(nonce) + sodium.to_hex(ciphertext);
}

/** Decrypt a ciphertext message from a sender */
export async function decryptMessage(
  ciphertextHex: string,
  senderPublicKeyHex: string
): Promise<string> {
  await sodium.ready;
  const senderPk = sodium.from_hex(senderPublicKeyHex);
  const privateKey = await getPrivateKey();
  if (!privateKey) throw new Error('Private key not available');
  const sharedSecret = sodium.crypto_scalarmult(privateKey, senderPk);
  const nonceSize = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  const nonce = sodium.from_hex(ciphertextHex.slice(0, nonceSize * 2));
  const ciphertext = sodium.from_hex(ciphertextHex.slice(nonceSize * 2));
  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    null,
    nonce,
    sharedSecret
  );
  return sodium.to_string(plaintext);
}
