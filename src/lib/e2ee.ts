import { get, set } from 'idb-keyval';
import sodium from 'libsodium-wrappers';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Initialize libsodium and generate a Curve25519 key pair for the user if not already generated.
 * The private key is stored in IndexedDB, public key in Firestore under `users/{uid}.e2ePublicKey`.
 */
export async function initUserKeys(uid: string, db: any) {
  if (!uid || !db) return;
  try {
    await sodium.ready;
    let existingPrivateHex = await get('e2ee_private_key') as string | undefined;
    
    if (!existingPrivateHex) {
      const keyPair = sodium.crypto_kx_keypair();
      existingPrivateHex = sodium.to_hex(keyPair.privateKey);
      await set('e2ee_private_key', existingPrivateHex);
      
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { e2ePublicKey: sodium.to_hex(keyPair.publicKey) }, { merge: true });
    }
  } catch (err) {
    console.error('Error initializing E2EE keys:', err);
  }
}

/** Retrieve the stored private key from IndexedDB */
export async function getPrivateKey(): Promise<Uint8Array | null> {
  try {
    await sodium.ready;
    const hex = (await get('e2ee_private_key')) as string | undefined;
    if (!hex) return null;
    return sodium.from_hex(hex);
  } catch {
    return null;
  }
}

/** Get a user's public key from Firestore */
export async function getPublicKey(uid: string, db: any): Promise<string | null> {
  if (!uid || !db) return null;
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return null;
    const data = userDoc.data();
    return data?.e2ePublicKey || null;
  } catch (err) {
    console.error('Error fetching public key:', err);
    return null;
  }
}

/** Encrypt a plaintext message for a recipient using XChaCha20-Poly1305 */
export async function encryptMessage(
  plaintext: string,
  recipientPublicKeyHex: string
): Promise<string> {
  try {
    await sodium.ready;
    if (!recipientPublicKeyHex) return plaintext;
    const recipientPk = sodium.from_hex(recipientPublicKeyHex);
    const privateKey = await getPrivateKey();
    if (!privateKey) return plaintext;
    
    const sharedSecret = sodium.crypto_scalarmult(privateKey, recipientPk);
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      sodium.from_string(plaintext),
      null,
      null,
      nonce,
      sharedSecret
    );
    return 'e2e:' + sodium.to_hex(nonce) + sodium.to_hex(ciphertext);
  } catch (err) {
    console.error('Encryption fallback to plain text:', err);
    return plaintext;
  }
}

/** Decrypt a ciphertext message from a sender, falling back to plain text */
export async function decryptMessage(
  text: string,
  senderPublicKeyHex?: string | null
): Promise<string> {
  if (!text) return '';
  // If text does not start with 'e2e:' prefix, it is unencrypted plain text!
  if (!text.startsWith('e2e:')) {
    return text;
  }

  try {
    await sodium.ready;
    if (!senderPublicKeyHex) return text.replace(/^e2e:/, '');
    const ciphertextHex = text.replace(/^e2e:/, '');
    
    const senderPk = sodium.from_hex(senderPublicKeyHex);
    const privateKey = await getPrivateKey();
    if (!privateKey) return ciphertextHex;

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
  } catch (err) {
    // If decryption fails, return text cleanly without crashing
    return text.replace(/^e2e:/, '');
  }
}
