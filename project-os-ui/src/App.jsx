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
import SideNav          from './components/SideNav.jsx'
import ActionBar        from './components/ActionBar.jsx'
import CommandPalette   from './components/CommandPalette.jsx'
import IntegrationsBar  from './components/IntegrationsBar.jsx'
import DashboardView from './views/DashboardView.jsx'
import ChatView from './views/ChatView.jsx'
import BriefView from './views/BriefView.jsx'
import RAIDView from './views/RAIDView.jsx'
import EVMView from './views/EVMView.jsx'
import TelemetryView from './views/TelemetryView.jsx'
import SpecialistsView from './views/SpecialistsView.jsx'
import DocsView from './views/DocsView.jsx'
import MarketplaceView from './views/MarketplaceView.jsx'
import KnowledgeView   from './views/KnowledgeView.jsx'
import WorkspaceView   from './views/WorkspaceView.jsx'
import WorkroomView    from './views/WorkroomView.jsx'
import IntegrationsView from './views/IntegrationsView.jsx'
import ABView           from './views/ABView.jsx'
import ProjectListPage from './views/ProjectListPage.jsx'
import AuthPage        from './views/AuthPage.jsx'
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
  const [cmdOpen,   setCmdOpen]   = useState(false)
  const prevStageRef = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true) }
      if (e.key === 'Escape') setCmdOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  function handleNav(viewId) {
    setView(viewId)
    setCmdOpen(false)
  }

  return (
    <>
      <div className="shell">
        <SideNav
          view={view}
          setView={setView}
          project={project}
          state={stateWithAssignments}
          onOpenChat={() => setChatOpen(true)}
          onNewProject={() => navigate('/')}
          onOpenCommandPalette={() => setCmdOpen(true)}
          badges={{ raid: hasHighRisk }}
        />

        <header className="tb">
          <span className="tb__crumb tb__crumb--mut">ProjectOS</span>
          <span className="tb__crumb-sep">/</span>
          <span className="tb__crumb">{project?.title ?? '…'}</span>
          <div className="tb__spacer" />
          <div className="tb__right">
            <button className="tb__icon-btn" title="Search" onClick={() => setCmdOpen(true)}>⌕</button>
            <button className="tb__icon-btn tb__icon-btn--alert" title="Notifications">◔</button>
            <button className="tb__icon-btn" title="Back to projects" onClick={() => navigate('/')}>←</button>
          </div>
        </header>

        <ActionBar view={view} project={project} />

        <main className="ct">
          <IntegrationsBar />

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
          {view === 'telemetry'    && <TelemetryView projectId={id} />}
          {view === 'specialists'  && <SpecialistsView projectId={id} project={project} state={state} refresh={refresh} />}
          {view === 'docs'         && <DocsView projectId={id} project={project} />}
          {view === 'marketplace'  && <MarketplaceView />}
          {view === 'knowledge'    && <KnowledgeView project={project} />}
          {view === 'workspace'    && <WorkspaceView project={project} />}
          {view === 'workroom'     && <WorkroomView projectId={id} project={project} />}
          {view === 'integrations' && <IntegrationsView />}
          {view === 'ab'           && <ABView />}
        </main>

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

      {cmdOpen && (
        <CommandPalette
          onClose={() => setCmdOpen(false)}
          onNavigate={handleNav}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('project-os:user')) } catch { return null }
  })

  function handleAuth(authedUser) {
    setUser(authedUser)
  }

  function handleLogout() {
    localStorage.removeItem('project-os:token')
    localStorage.removeItem('project-os:user')
    setUser(null)
  }

  if (!user) return <AuthPage onAuth={handleAuth} />

  return (
    <Routes>
      <Route path="/"                element={<ProjectListPage onLogout={handleLogout} />} />
      <Route path="/projects/:id/*"  element={<ProjectShell onLogout={handleLogout} />} />
    </Routes>
  )
}
