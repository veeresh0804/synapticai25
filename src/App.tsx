import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import type { UserType } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";

import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound";
import AiInterviewerGuidePage from "./pages/AiInterviewerGuidePage";
import BiasFreeHiringGuidePage from "./pages/BiasFreeHiringGuidePage";

import RecruiterLogin from "./pages/recruiter/RecruiterLogin";
import RecruiterRegister from "./pages/recruiter/RecruiterRegister";
import RecruiterDashboard from "./pages/recruiter/RecruiterDashboard";
import PostJobPage from "./pages/recruiter/PostJobPage";
import CandidateRankingPage from "./pages/recruiter/CandidateRankingPage";
import AnalyticsDashboard from "./pages/recruiter/AnalyticsDashboard";
import InterviewSchedulePage from "./pages/recruiter/InterviewSchedulePage";
import TalentDiscoveryPage from "./pages/recruiter/TalentDiscoveryPage";
import ResumeAuthenticityPage from "./pages/recruiter/ResumeAuthenticityPage";
import ProjectScoringPage from "./pages/recruiter/ProjectScoringPage";
import RecruiterCRMPage from "./pages/recruiter/RecruiterCRMPage";
import TalentRadarPage from "./pages/recruiter/TalentRadarPage";
import BiasDetectorPage from "./pages/recruiter/BiasDetectorPage";
import RecruiterAgentPage from "./pages/recruiter/RecruiterAgentPage";

import StudentLogin from "./pages/student/StudentLogin";
import StudentRegister from "./pages/student/StudentRegister";
import StudentDashboard from "./pages/student/StudentDashboard";
import JobListingsPage from "./pages/student/JobListingsPage";
import JobDetailPage from "./pages/student/JobDetailPage";
import ApplicationsPage from "./pages/student/ApplicationsPage";
import StudentProfilePage from "./pages/student/StudentProfilePage";
import EligibilityCheckerPage from "./pages/student/EligibilityCheckerPage";
import InterviewsPage from "./pages/student/InterviewsPage";
import NotificationsPage from "./pages/student/NotificationsPage";
import CareerPathPage from "./pages/student/CareerPathPage";
import PortfolioBuilderPage from "./pages/student/PortfolioBuilderPage";
import InterviewSimPage from "./pages/student/InterviewSimPage";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";

const queryClient = new QueryClient();

// DEV-only visual reference gallery (code-split; never registered in production).
const DesignReferencePage = React.lazy(() => import("./pages/DesignReferencePage"));

const ProtectedRoute = ({
  children,
  requiredType,
}: {
  children: React.ReactNode;
  requiredType: UserType;
}) => {
  const { isAuthenticated, userType, user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><span>Loading...</span></div>;
  if (!isAuthenticated) return <Navigate to={`/${requiredType ?? 'student'}/login`} replace />;
  // Fresh OAuth session without a profile yet — route to onboarding instead of bouncing.
  if (!userType && user) return <Navigate to="/auth/callback" replace />;
  if (userType !== requiredType) {
    if (userType) return <Navigate to={`/${userType}/dashboard`} replace />;
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="min-h-screen bg-background">
            <Navbar />
            <main id="main-content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/resources/ai-interviewer-guide" element={<AiInterviewerGuidePage />} />
                <Route path="/resources/bias-free-hiring-guide" element={<BiasFreeHiringGuidePage />} />

                {/* Recruiter Routes */}
                <Route path="/recruiter/login" element={<RecruiterLogin />} />
                <Route path="/recruiter/register" element={<RecruiterRegister />} />
                <Route path="/recruiter/dashboard" element={<ProtectedRoute requiredType="recruiter"><RecruiterDashboard /></ProtectedRoute>} />
                <Route path="/recruiter/post-job" element={<ProtectedRoute requiredType="recruiter"><PostJobPage /></ProtectedRoute>} />
                <Route path="/recruiter/jobs/:jobId/candidates" element={<ProtectedRoute requiredType="recruiter"><CandidateRankingPage /></ProtectedRoute>} />
                <Route path="/recruiter/analytics" element={<ProtectedRoute requiredType="recruiter"><AnalyticsDashboard /></ProtectedRoute>} />
                <Route path="/recruiter/interviews" element={<ProtectedRoute requiredType="recruiter"><InterviewSchedulePage /></ProtectedRoute>} />
                <Route path="/recruiter/talent" element={<ProtectedRoute requiredType="recruiter"><TalentDiscoveryPage /></ProtectedRoute>} />
                <Route path="/recruiter/authenticity" element={<ProtectedRoute requiredType="recruiter"><ResumeAuthenticityPage /></ProtectedRoute>} />
                <Route path="/recruiter/project-scoring" element={<ProtectedRoute requiredType="recruiter"><ProjectScoringPage /></ProtectedRoute>} />
                <Route path="/recruiter/crm" element={<ProtectedRoute requiredType="recruiter"><RecruiterCRMPage /></ProtectedRoute>} />
                <Route path="/recruiter/talent-radar" element={<ProtectedRoute requiredType="recruiter"><TalentRadarPage /></ProtectedRoute>} />
                <Route path="/recruiter/bias-detector" element={<ProtectedRoute requiredType="recruiter"><BiasDetectorPage /></ProtectedRoute>} />
                <Route path="/recruiter/agent" element={<ProtectedRoute requiredType="recruiter"><RecruiterAgentPage /></ProtectedRoute>} />

                {/* Student Routes */}
                <Route path="/student/login" element={<StudentLogin />} />
                <Route path="/student/register" element={<StudentRegister />} />
                <Route path="/student/dashboard" element={<ProtectedRoute requiredType="student"><StudentDashboard /></ProtectedRoute>} />
                <Route path="/student/jobs" element={<ProtectedRoute requiredType="student"><JobListingsPage /></ProtectedRoute>} />
                <Route path="/student/jobs/:jobId" element={<ProtectedRoute requiredType="student"><JobDetailPage /></ProtectedRoute>} />
                <Route path="/student/jobs/:jobId/eligibility" element={<ProtectedRoute requiredType="student"><EligibilityCheckerPage /></ProtectedRoute>} />
                <Route path="/student/applications" element={<ProtectedRoute requiredType="student"><ApplicationsPage /></ProtectedRoute>} />
                <Route path="/student/profile" element={<ProtectedRoute requiredType="student"><StudentProfilePage /></ProtectedRoute>} />
                <Route path="/student/interviews" element={<ProtectedRoute requiredType="student"><InterviewsPage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute requiredType="student"><NotificationsPage /></ProtectedRoute>} />
                <Route path="/student/notifications" element={<ProtectedRoute requiredType="student"><NotificationsPage /></ProtectedRoute>} />
                <Route path="/student/career-path" element={<ProtectedRoute requiredType="student"><CareerPathPage /></ProtectedRoute>} />
                <Route path="/student/portfolio" element={<ProtectedRoute requiredType="student"><PortfolioBuilderPage /></ProtectedRoute>} />
                <Route path="/student/interview-sim" element={<ProtectedRoute requiredType="student"><InterviewSimPage /></ProtectedRoute>} />

                {/* Admin Routes */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<ProtectedRoute requiredType="admin"><AdminDashboard /></ProtectedRoute>} />

                {/* DEV-only design reference gallery */}
                {import.meta.env.DEV && (
                  <Route
                    path="/design-reference"
                    element={
                      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span>Loading…</span></div>}>
                        <DesignReferencePage />
                      </Suspense>
                    }
                  />
                )}

                {/* Password Reset */}
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />

                {/* Legacy redirects */}
                <Route path="/recruiter" element={<Navigate to="/recruiter/login" replace />} />
                <Route path="/student" element={<Navigate to="/student/login" replace />} />
                <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
