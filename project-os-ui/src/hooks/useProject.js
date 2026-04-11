/**
 * hooks/useProject.js — v0.6.1
 *
 * Root cause fix for "run retro" journey:
 * - transition() now returns { success, stage } so callers know outcome
 * - transition() handles errors and sets them on the error state
 * - No more .then() chaining for view switching — that's done reactively in App
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchProject, sendMessage, approveProject, updateTask, addTaskComment, transitionStage } from '../lib/api.js'

export function useProject(projectId) {
  const [project,       setProject]       = useState(null)
  const [state,         setState]         = useState(null)
  const [conversation,  setConversation]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [sending,       setSending]       = useState(false)
  const [approving,     setApproving]     = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [error,         setError]         = useState(null)
  const [gateError,     setGateError]     = useState(null)

  const stageRef   = useRef(null)
  const sendingRef = useRef(false)

  // ── Refresh — always fetches fresh project + state ─────────────────────────
  const refresh = useCallback(async () => {
    const data = await fetchProject(projectId)
    setProject(data.project)
    setState(data.state)
    stageRef.current = data.project?.stage ?? null
    return data
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    setConversation([])
    refresh().catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [projectId, refresh])

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = useCallback(async (message) => {
    if (!message.trim() || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setGateError(null)
    setError(null)

    const tempId     = `opt-${Date.now()}`
    const optimistic = { id: tempId, role: 'user', content: message, created_at: new Date().toISOString() }
    setConversation(prev => [...prev, optimistic])

    try {
      const data = await sendMessage(projectId, message)

      if (data.reply) {
        const assistantMsg = {
          id: `srv-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          created_at: new Date().toISOString(),
        }
        setConversation(prev => [
          ...prev.filter(m => m.id !== tempId),
          { ...optimistic, id: `confirmed-${Date.now()}` },
          assistantMsg,
        ])
      } else {
        setConversation(prev => prev.map(m =>
          m.id === tempId ? { ...m, id: `confirmed-${Date.now()}` } : m
        ))
      }

      // Always refresh — stage/tasks/risks may have changed
      await refresh()

    } catch (err) {
      setConversation(prev => prev.filter(m => m.id !== tempId))
      if (err.status === 422 && err.code) {
        setGateError({ message: err.message, code: err.code, redirect: err.redirect, context: err.context })
      } else {
        setError(err.message ?? 'Failed to send message')
      }
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [projectId, refresh])

  // ── Task update ───────────────────────────────────────────────────────────
  const updateTaskDirect = useCallback(async (taskKey, updates) => {
    setState(prev => {
      if (!prev) return prev
      return {
        ...prev,
        phases: prev.phases.map(ph => ({
          ...ph,
          milestones: ph.milestones.map(ms => ({
            ...ms,
            tasks: ms.tasks.map(t =>
              t.task_key === taskKey ? { ...t, ...updates } : t
            ),
          })),
        })),
      }
    })
    try {
      await updateTask(projectId, taskKey, updates)
      await refresh()
    } catch (err) {
      await refresh()
      throw err
    }
  }, [projectId, refresh])

  // ── Comment ───────────────────────────────────────────────────────────────
  const addComment = useCallback(async (taskKey, comment) => {
    await addTaskComment(projectId, taskKey, comment)
    await refresh()
  }, [projectId, refresh])

  // ── Approve ───────────────────────────────────────────────────────────────
  const approve = useCallback(async (confirmed, notes) => {
    setApproving(true)
    setError(null)
    try {
      const data = await approveProject(projectId, confirmed, notes)
      if (data.approved) await refresh()
      return data
    } catch (err) {
      setError(err.message ?? 'Approval failed')
      throw err
    } finally {
      setApproving(false)
    }
  }, [projectId, refresh])

  // ── Transition ────────────────────────────────────────────────────────────
  // Returns { success: true, stage } or { success: false, error }
  // Does NOT control view navigation — that's done reactively in the component
  const transition = useCallback(async (toStage) => {
    setTransitioning(true)
    setError(null)
    try {
      const data = await transitionStage(projectId, toStage)

      // Update project state immediately with server response
      if (data.project) {
        setProject(data.project)
        stageRef.current = data.project.stage ?? null
      }

      // Inject agent intro into conversation
      if (data.conversation?.length) {
        setConversation(data.conversation)
      }

      // Full refresh — gets milestone completed_at, updated risks, etc.
      await refresh()

      return { success: true, stage: data.stage ?? toStage }
    } catch (err) {
      const message = err.message ?? 'Stage transition failed'
      setError(message)
      return { success: false, error: message }
    } finally {
      setTransitioning(false)
    }
  }, [projectId, refresh])

  return {
    project, state, conversation,
    loading, sending, approving, transitioning,
    error, gateError,
    send, approve, refresh, transition,
    updateTaskDirect, addComment,
    clearGateError: useCallback(() => setGateError(null), []),
  }
}
