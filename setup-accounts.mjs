import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAk4DcDNed4OWSahdV56ll1wI973-0wgS4",
  authDomain: "impactful-ideas.firebaseapp.com",
  databaseURL: "https://impactful-ideas-default-rtdb.firebaseio.com",
  projectId: "impactful-ideas",
  storageBucket: "impactful-ideas.firebasestorage.app",
  messagingSenderId: "494901200454",
  appId: "1:494901200454:web:0ea71cc5dbe22b22f6ac47",
  measurementId: "G-P5TSD6JL5Y"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createOrUpdateAccount(email, password, displayName, handle, isProfessional) {
  let user;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    user = userCredential.user;
    console.log(`Created Auth User: ${email}`);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      user = userCredential.user;
      console.log(`Signed in existing Auth User: ${email}`);
    } else {
      console.error(`Error for ${email}:`, e.message);
      return;
    }
  }

  // Update user doc
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: displayName,
    handle: handle,
    photoURL: "https://ui-avatars.com/api/?name=" + displayName,
    isProfessional: isProfessional,
    bio: isProfessional ? "Official Admin Account" : "Dummy Account for Review",
    followers: 0,
    following: 0,
    createdAt: new Date().toISOString()
  }, { merge: true });
  
  console.log(`Updated Firestore Doc for: ${email}`);
}

async function main() {
  await createOrUpdateAccount("lonkind_admin@lonkind.com", "LonkindAdmin2026!", "Lonkind Admin", "lonkind_admin", true);
  await createOrUpdateAccount("paystack_review@lonkind.com", "PaystackReview2026!", "Paystack Reviewer", "paystack_reviewer", false);
  process.exit(0);
}

main();
