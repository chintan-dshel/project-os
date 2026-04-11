/**
 * App.jsx — v1.0 Router Shell
 *
 * Routes:
 *   /                  → ProjectListPage (project switcher)
 *   /projects/:id/*    → ProjectShell (single project view)
 *
 * ProjectShell owns:
 *   - SideNav (stage-aware)
 *   - StageTimeline (topbar)
 *   - Chat slide-in panel
 *   - View routing (dashboard | brief | raid | analytics | specialists | docs | marketplace)
 */

import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { useProject } from './hooks/useProject.js'
import { ApprovalGate, GateErrorBanner } from './components/GateBanner.jsx'
import SideNav from './components/SideNav.jsx'
import StageTimeline from './components/StageTimeline.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import DashboardView from './views/DashboardView.jsx'
import ChatView from './views/ChatView.jsx'
import BriefView from './views/BriefView.jsx'
import RAIDView from './views/RAIDView.jsx'
import EVMView from './views/EVMView.jsx'
import SpecialistsView from './views/SpecialistsView.jsx'
import DocsView from './views/DocsView.jsx'
import MarketplaceView from './views/MarketplaceView.jsx'
import KnowledgeView   from './views/KnowledgeView.jsx'
import WorkspaceView   from './views/WorkspaceView.jsx'
import ProjectListPage from './views/ProjectListPage.jsx'
import './styles.css'

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT SHELL — owns a single project's layout
// ─────────────────────────────────────────────────────────────────────────────

function ProjectShell() {
  const { id } = useParams()
  const navigate = useNavigate()

  const {
    project, state, conversation,
    loading, sending, approving, transitioning,
    error, gateError,
    send, approve, clearGateError, refresh,
    updateTaskDirect, addComment, transition,
  } = useProject(id)

  const [view,      setView]      = useState('dashboard')
  const [chatOpen,  setChatOpen]  = useState(false)
  const prevStageRef = useRef(null)

  // Reactive: when stage changes, auto-open chat or navigate to dashboard
  useEffect(() => {
    const stage = project?.stage
    if (!stage) return
    const prev = prevStageRef.current
    prevStageRef.current = stage
    if (prev === null || prev === stage) return

    if (stage === 'milestone_retro' || stage === 'ship_retro') {
      setChatOpen(true)
    } else if (stage === 'execution' && (prev === 'milestone_retro' || prev === 'awaiting_approval')) {
      setView('dashboard')
      setChatOpen(false)
    } else if (stage === 'complete') {
      setView('dashboard')
      setChatOpen(false)
    }
  }, [project?.stage])

  // Persist last-visited project for quick return
  useEffect(() => {
    if (id) localStorage.setItem('project-os:last-id', id)
  }, [id])

  if (loading) return (
    <div className="loading-screen">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </div>
  )

  const isAwaiting   = project?.stage === 'awaiting_approval'
  const chatDisabled = !!gateError && gateError.code !== 'GATE_PLAN_NOT_APPROVED'
  const hasHighRisk  = (state?.risk_register ?? []).some(r => r.risk_score >= 7 && r.status === 'open' && !r.description?.startsWith('ASSUMPTION:'))

  // Count pending assignments to surface in SideNav NOW section
  const stateWithAssignments = {
    ...state,
    pending_assignments: state?.pending_assignments ?? 0,
  }

  return (
    <div className="shell">
      <SideNav
        view={view}
        setView={setView}
        project={project}
        state={stateWithAssignments}
        onOpenChat={() => setChatOpen(true)}
        onNewProject={() => navigate('/')}
        badges={{ raid: hasHighRisk }}
      />

      <header className="topbar">
        <button className="topbar__back" onClick={() => navigate('/')} title="All projects">←</button>
        <div className="topbar__title">{project?.title ?? '…'}</div>
        <div className="topbar__timeline">
          {project && <StageTimeline stage={project.stage} />}
        </div>
        <ThemeToggle />
        <div className="topbar__id">{id?.slice(0, 8)}</div>
      </header>

      <main className="content">
        {/* Gate / error banners (dashboard only) */}
        {(isAwaiting || gateError || error) && view === 'dashboard' && (
          <div className="view-banners">
            {isAwaiting && <ApprovalGate project={project} onApprove={approve} approving={approving} />}
            {gateError  && <GateErrorBanner gateError={gateError} onDismiss={clearGateError} />}
            {error      && <div className="error-bar">{error}</div>}
          </div>
        )}

        {view === 'dashboard'    && (
          <DashboardView
            project={project} state={state}
            updateTaskDirect={updateTaskDirect} addComment={addComment}
            transition={transition} setView={setView} transitioning={transitioning}
            onOpenChat={() => setChatOpen(true)}
          />
        )}
        {view === 'brief'        && <BriefView project={project} state={state} />}
        {view === 'raid'         && <RAIDView projectId={id} state={state} refresh={refresh} />}
        {view === 'analytics'    && <EVMView project={project} state={state} />}
        {view === 'specialists'  && <SpecialistsView projectId={id} project={project} state={state} refresh={refresh} />}
        {view === 'docs'         && <DocsView projectId={id} project={project} />}
        {view === 'marketplace'  && <MarketplaceView />}
        {view === 'knowledge'    && <KnowledgeView project={project} />}
        {view === 'workspace'    && <WorkspaceView project={project} />}
      </main>

      {/* Chat slide-in panel */}
      {chatOpen && (
        <ChatView
          project={project}
          state={state}
          conversation={conversation}
          sending={sending}
          onSend={send}
          chatDisabled={chatDisabled}
          isAwaiting={isAwaiting && view !== 'dashboard'}
          approve={approve}
          approving={approving}
          gateError={gateError}
          clearGateError={clearGateError}
          error={error}
          isPanel={true}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Routes>
      <Route path="/"                element={<ProjectListPage />} />
      <Route path="/projects/:id/*"  element={<ProjectShell />} />
    </Routes>
  )
}
