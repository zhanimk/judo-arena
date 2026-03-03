// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBhdLEubiHy6qe0vbNFSu3o28gUcCptbIc",
  authDomain: "judo-manager-41009.firebaseapp.com",
  projectId: "judo-manager-41009",
  storageBucket: "judo-manager-41009.firebasestorage.app",
  messagingSenderId: "230481878800",
  appId: "1:230481878800:web:d3c1dcb804441c7b3ecf95",
  measurementId: "G-HN590SPPFW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
