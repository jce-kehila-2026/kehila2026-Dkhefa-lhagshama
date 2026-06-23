export const firebaseApp: any = { name: '[DEFAULT]', options: {} }

export const firebaseAuth: any = {
  currentUser: null,
  onAuthStateChanged: () => () => {},
  signOut: async () => {},
}

export const firebaseDb: any = {}
