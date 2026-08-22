import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/require-auth'
import { DashboardPage } from '@/pages/dashboard/dashboard-page'
import { DataRoomPage } from '@/pages/data-room/data-room-page'
import { SharedResourcePage } from '@/pages/shared/shared-resource-page'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/data-rooms/:dataRoomId"
          element={
            <RequireAuth>
              <DataRoomPage />
            </RequireAuth>
          }
        />
        <Route path="/shared/:token" element={<SharedResourcePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
