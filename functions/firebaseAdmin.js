const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

function initializeAdminApp() {
  return getApps()[0] || initializeApp();
}

function getAdminAuth() {
  return getAuth(initializeAdminApp());
}

function getAdminFirestore() {
  return getFirestore(initializeAdminApp());
}

function getAdminStorage() {
  return getStorage(initializeAdminApp());
}

module.exports = {
  getAdminAuth,
  getAdminFirestore,
  getAdminStorage,
  initializeAdminApp,
};
