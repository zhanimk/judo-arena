import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth-context';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTournaments from './pages/admin/AdminTournaments';
import AdminTournamentDetails from './pages/admin/AdminTournamentDetails';
import AdminApplications from './pages/admin/AdminApplications';
import AdminBrackets from './pages/admin/AdminBrackets';
import AdminUsers from './pages/admin/AdminUsers';
import AdminClubs from './pages/admin/AdminClubs';
import AthleteDashboard from './pages/athlete/AthleteDashboard';
import AthleteProfile from './pages/athlete/AthleteProfile';
import AthleteClub from './pages/athlete/AthleteClub';
import AthleteParticipation from './pages/athlete/AthleteParticipation';
import AthleteResults from './pages/athlete/AthleteResults';
import CoachDashboard from './pages/coach/CoachDashboard';
import CoachClub from './pages/coach/CoachClub';
import CoachAthletes from './pages/coach/CoachAthletes';
import CoachApplications from './pages/coach/CoachApplications';
import CoachTournaments from './pages/coach/CoachTournaments';
import JudgeDashboard from './pages/judge/JudgeDashboard';
import JudgeQueue from './pages/judge/JudgeQueue';
import JudgeMatchControl from './pages/judge/JudgeMatchControl';
import JudgeScoreboard from './pages/judge/JudgeScoreboard';
import ForbiddenPage from './pages/ForbiddenPage';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/403" element={<ForbiddenPage />} />

              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/tournaments" element={<AdminTournaments />} />
                <Route path="/admin/tournaments/:id" element={<AdminTournamentDetails />} />
                <Route path="/admin/applications" element={<AdminApplications />} />
                <Route path="/admin/brackets" element={<AdminBrackets />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/clubs" element={<AdminClubs />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['athlete']} />}>
                <Route path="/athlete" element={<AthleteDashboard />} />
                <Route path="/athlete/profile" element={<AthleteProfile />} />
                <Route path="/athlete/club" element={<AthleteClub />} />
                <Route path="/athlete/participation" element={<AthleteParticipation />} />
                <Route path="/athlete/results" element={<AthleteResults />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['coach']} />}>
                <Route path="/coach" element={<CoachDashboard />} />
                <Route path="/coach/club" element={<CoachClub />} />
                <Route path="/coach/athletes" element={<CoachAthletes />} />
                <Route path="/coach/applications" element={<CoachApplications />} />
                <Route path="/coach/tournaments" element={<CoachTournaments />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['judge']} />}>
                <Route path="/judge" element={<JudgeDashboard />} />
                <Route path="/judge/queue" element={<JudgeQueue />} />
                <Route path="/judge/match" element={<JudgeMatchControl />} />
                <Route path="/judge/scoreboard" element={<JudgeScoreboard />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
