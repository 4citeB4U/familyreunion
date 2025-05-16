// Firebase Configuration
// This file initializes Firebase and exports the Firebase instances

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Firebase configuration
// These values should be replaced with environment variables in production
const firebaseConfig = {
  apiKey: "AIzaSyAtubd5uYPLBOsg4BXChL0gJUSLFxsq4P8",
  authDomain: "familyreunion-c25b0.firebaseapp.com",
  projectId: "familyreunion-c25b0",
  storageBucket: "familyreunion-c25b0.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:1234567890abcdef",
  databaseURL: "https://familyreunion-c25b0-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const rtdb = getDatabase(app);

// Collection references
const attendeesRef = collection(db, "attendees");
const messagesRef = collection(db, "messages");
const activitiesRef = collection(db, "activities");
const foodsRef = collection(db, "foods");
const usersRef = collection(db, "users");

// Helper functions for Firestore operations
const firestoreHelpers = {
  // Add a document to a collection
  addDocument: async (collectionRef, data) => {
    try {
      const docRef = await addDoc(collectionRef, {
        ...data,
        timestamp: serverTimestamp()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error("Error adding document:", error);
      throw error;
    }
  },
  
  // Get all documents from a collection
  getDocuments: async (collectionRef) => {
    try {
      const snapshot = await getDocs(collectionRef);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error getting documents:", error);
      throw error;
    }
  },
  
  // Get a document by ID
  getDocument: async (collectionRef, id) => {
    try {
      const docRef = doc(collectionRef, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error getting document:", error);
      throw error;
    }
  },
  
  // Update a document
  updateDocument: async (collectionRef, id, data) => {
    try {
      const docRef = doc(collectionRef, id);
      await updateDoc(docRef, data);
      return { id, ...data };
    } catch (error) {
      console.error("Error updating document:", error);
      throw error;
    }
  },
  
  // Delete a document
  deleteDocument: async (collectionRef, id) => {
    try {
      const docRef = doc(collectionRef, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error("Error deleting document:", error);
      throw error;
    }
  },
  
  // Query documents
  queryDocuments: async (collectionRef, field, operator, value) => {
    try {
      const q = query(collectionRef, where(field, operator, value));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error querying documents:", error);
      throw error;
    }
  },
  
  // Listen for real-time updates
  onSnapshotListener: (collectionRef, callback) => {
    return onSnapshot(collectionRef, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(docs);
    });
  }
};

// Helper functions for Realtime Database operations
const rtdbHelpers = {
  // Set data at a specific path
  setData: async (path, data) => {
    try {
      const reference = ref(rtdb, path);
      await set(reference, data);
      return data;
    } catch (error) {
      console.error("Error setting data:", error);
      throw error;
    }
  },
  
  // Push data to a list
  pushData: async (path, data) => {
    try {
      const listRef = ref(rtdb, path);
      const newRef = push(listRef);
      await set(newRef, data);
      return { id: newRef.key, ...data };
    } catch (error) {
      console.error("Error pushing data:", error);
      throw error;
    }
  },
  
  // Listen for real-time updates
  onValueListener: (path, callback) => {
    const reference = ref(rtdb, path);
    return onValue(reference, (snapshot) => {
      callback(snapshot.val());
    });
  },
  
  // Update data at a specific path
  updateData: async (path, data) => {
    try {
      const reference = ref(rtdb, path);
      await update(reference, data);
      return data;
    } catch (error) {
      console.error("Error updating data:", error);
      throw error;
    }
  }
};

// Authentication helpers
const authHelpers = {
  // Sign in anonymously
  signInAnonymously: async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      return userCredential.user;
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      throw error;
    }
  },
  
  // Listen for auth state changes
  onAuthStateChanged: (callback) => {
    return onAuthStateChanged(auth, callback);
  },
  
  // Get current user
  getCurrentUser: () => {
    return auth.currentUser;
  }
};

// Export Firebase instances and helpers
export {
  app,
  db,
  auth,
  rtdb,
  attendeesRef,
  messagesRef,
  activitiesRef,
  foodsRef,
  usersRef,
  firestoreHelpers,
  rtdbHelpers,
  authHelpers,
  serverTimestamp
};
