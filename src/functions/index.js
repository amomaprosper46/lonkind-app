
const {onRequest} = require("firebase-functions/v2/https");
const {default: next} = require("next");
const admin = require("firebase-admin");

admin.initializeApp();

const isDev = process.env.NODE_ENV !== "production";

const server = next({
    dev: isDev,
    conf: { distDir: ".next" },
});

const nextjsHandle = server.getRequestHandler();

exports.server = onRequest((req, res) => {
    return server.prepare().then(() => nextjsHandle(req, res));
});


const {onValueWritten} = require("firebase-functions/v2/database");
const firestore = admin.firestore();

exports.onUserStatusChanged = onValueWritten("/status/{uid}", async (event) => {
    const { uid } = event.params;
    const { after } = event.data;
    const status = after.val();
    
    const userStatusFirestoreRef = firestore.doc(`/users/${uid}`);

    return userStatusFirestoreRef.update({
        presence: {
            state: status.state,
            last_changed: status.last_changed,
        }
    });
});
