import { createContext, useContext, useState, useCallback } from 'react'
import { mockRequests, mockUsers, mockVolunteers, mockBusinesses } from '../data/mockData'

const AppContext = createContext(null)

let toastId = 0

export function AppProvider({ children }) {
  // ── TOAST ──────────────────────────────────────────────
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── REQUESTS ───────────────────────────────────────────
  const [requests, setRequests] = useState(mockRequests)

  const addRequest = useCallback((req) => {
    const newReq = {
      ...req,
      id: `PFF-${new Date().getFullYear()}-${String(requests.length + 248).padStart(4, '0')}`,
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
      handler: null,
      notes: '',
    }
    setRequests(prev => [newReq, ...prev])
    return newReq.id
  }, [requests.length])

  const updateRequest = useCallback((id, updates) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }, [])

  const deleteRequest = useCallback((id) => {
    setRequests(prev => prev.filter(r => r.id !== id))
  }, [])

  // ── USERS ──────────────────────────────────────────────
  const [users, setUsers] = useState(mockUsers)

  const deleteUser = useCallback((id) => {
    setUsers(prev => prev.filter(u => u.id !== id))
  }, [])

  // ── VOLUNTEERS ─────────────────────────────────────────
  const [volunteers, setVolunteers] = useState(mockVolunteers)

  const addVolunteer = useCallback((vol) => {
    const newVol = {
      ...vol,
      id: volunteers.length + 1,
      status: 'available',
      joinedDate: new Date().toISOString().slice(0, 7),
      assignedTo: null,
    }
    setVolunteers(prev => [...prev, newVol])
    return newVol.id
  }, [volunteers.length])

  // ── BUSINESSES ─────────────────────────────────────────
  const [businesses, setBusinesses] = useState(mockBusinesses)

  const addBusiness = useCallback((biz) => {
    const newBiz = { ...biz, id: businesses.length + 1, approved: false, rating: 0, reviews: 0 }
    setBusinesses(prev => [...prev, newBiz])
  }, [businesses.length])

  const approveBusiness = useCallback((id) => {
    setBusinesses(prev => prev.map(b => b.id === id ? { ...b, approved: true } : b))
  }, [])

  // ── MODAL ──────────────────────────────────────────────
  const [modal, setModal] = useState(null)
  const openModal = useCallback((content) => setModal(content), [])
  const closeModal = useCallback(() => setModal(null), [])

  return (
    <AppContext.Provider value={{
      toasts, toast, removeToast,
      requests, addRequest, updateRequest, deleteRequest,
      users, deleteUser,
      volunteers, addVolunteer,
      businesses, addBusiness, approveBusiness,
      modal, openModal, closeModal,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}