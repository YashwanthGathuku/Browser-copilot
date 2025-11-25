# 🚀 Nano Assistant - Complete Integration Plan

## Overview

This plan integrates **Enhanced Browser Agent**, **Task Scheduler**, **Agent Coordinator**, **Recording System**, and **Phase 5 Proactive Behavior** into the main application.

---

## **Option A: Integration** (Priority 1)

### 1. App.tsx Structure Changes

#### **Add New State Variables**

```typescript
// Task Scheduler
const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
const [showTaskScheduler, setShowTaskScheduler] = useState(false);

// Agent Coordinator
const [managedAgents, setManagedAgents] = useState<ManagedAgent[]>([]);
const [workflows, setWorkflows] = useState<Workflow[]>([]);

// Action Recorder
const [isRecording, setIsRecording] = useState(false);
const [recordings, setRecordings] = useState<Recording[]>([]);
const [showRecordings, setShowRecordings] = useState(false);

// Proactive Suggestions
const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
const [showSuggestions, setShowSuggestions] = useState(true);
```

#### **Add New Tab Options**

Current tabs: `"Chat"` | `"Agents"`

New tabs: `"Chat"` | `"Agents"` | `"Tasks"` | `"Recordings"` | `"Coordinator"`

---

### 2. Enhanced Agent Integration

#### **File: `src/sidepanel/hooks/useEnhancedAgent.ts`** (NEW)

```typescript
import { useState, useCallback } from "react";
import { createAgent } from "../../content/enhanced-agent";

export function useEnhancedAgent() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const execute = useCallback(async (script: string) => {
    setIsExecuting(true);
    try {
      const agent = createAgent();
      const result = await eval(script);
      setLastResult(result);
      return result;
    } catch (error) {
      console.error("[Enhanced Agent] Error:", error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  return { execute, isExecuting, lastResult };
}
```

---

### 3. Task Scheduler Integration

#### **Message Handlers (background/index.ts)**

```typescript
// Add to existing message handler
if (msg.type === "TASK_SCHEDULE") {
  const taskId = taskScheduler.schedule({
    goal: msg.goal,
    priority: msg.priority || "medium",
    schedule: msg.schedule,
    dependencies: msg.dependencies,
  });
  sendResponse({ ok: true, taskId });
  return;
}

if (msg.type === "TASK_LIST") {
  const tasks = taskScheduler.getAllTasks();
  sendResponse({ ok: true, tasks });
  return;
}

if (msg.type === "TASK_CANCEL") {
  const success = taskScheduler.cancel(msg.taskId);
  sendResponse({ ok: true, success });
  return;
}
```

#### **UI Component (Already Created)**

- Use `TaskSchedulerPanel` from `components/TaskScheduler.tsx`
- Add to new "Tasks" tab in App.tsx

---

### 4. Agent Coordinator Integration

#### **Message Handlers (background/index.ts)**

```typescript
// Initialize at startup
let coordinator: AgentCoordinator;

chrome.runtime.onStartup.addListener(async () => {
  coordinator = new AgentCoordinator();
  await coordinator.initialize(async () => {
    const lm = getLM();
    return lm.create({ systemPrompt: "You are a helpful AI assistant." });
  });
});

// Message handlers
if (msg.type === "AGENT_CREATE") {
  const agentId = await coordinator.createAgent(msg.role, msg.name);
  sendResponse({ ok: true, agentId });
  return;
}

if (msg.type === "WORKFLOW_EXECUTE") {
  const workflowId = await coordinator.executeWorkflow({
    name: msg.name,
    steps: msg.steps,
  });
  sendResponse({ ok: true, workflowId });
  return;
}

if (msg.type === "AGENTS_LIST") {
  const agents = coordinator.getAllAgents();
  sendResponse({ ok: true, agents });
  return;
}
```

#### **UI Component (Already Created)**

- Use `AgentCoordinatorPanel` from `components/AgentCoordinator.tsx`
- Add to new "Coordinator" tab

---

### 5. Recording UI Controls

#### **New Component: `components/RecordingPanel.tsx`** (CREATE)

```typescript
import { useState } from "react";
import { recorder, ActionRecorder } from "../../content/action-recorder";

export function RecordingPanel() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [recordingName, setRecordingName] = useState("");

  const handleStartRecording = () => {
    recorder.startRecording(recordingName || "Untitled Recording");
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    const recording = recorder.stopRecording();
    setIsRecording(false);
    loadRecordings();
  };

  const loadRecordings = async () => {
    const recs = await ActionRecorder.getRecordings();
    setRecordings(recs);
  };

  // UI with record button, recording list, replay, export
}
```

---

## **Option B: Phase 5 - Proactive Behavior** (Priority 2)

### 1. Context-Aware Suggestions

#### **File: `src/common/proactive-suggestions.ts`** (NEW)

```typescript
export interface Suggestion {
  id: string;
  type: "action" | "automation" | "info";
  title: string;
  description: string;
  action: () => Promise<void>;
  priority: "high" | "medium" | "low";
  dismissed?: boolean;
}

export class ProactiveSuggestions {
  async analyzePage(url: string, content: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Detect common scenarios
    if (url.includes("amazon.com") && content.includes("product")) {
      suggestions.push({
        id: "track-price",
        type: "automation",
        title: "Track Price",
        description: "Monitor this product and alert on price drops",
        action: async () => {
          /* setup price tracking */
        },
        priority: "medium",
      });
    }

    if (content.includes("form") && content.includes("required")) {
      suggestions.push({
        id: "autofill",
        type: "action",
        title: "Auto-fill Form",
        description: "Fill this form with saved data",
        action: async () => {
          /* autofill */
        },
        priority: "high",
      });
    }

    return suggestions;
  }
}
```

### 2. Pattern Learning

#### **File: `src/common/pattern-learner.ts`** (NEW)

```typescript
export class PatternLearner {
  private patterns: Map<string, Pattern> = new Map();

  recordAction(url: string, action: string, context: any) {
    // Track user actions
    const key = `${url}:${action}`;
    const pattern = this.patterns.get(key) || { count: 0, contexts: [] };
    pattern.count++;
    pattern.contexts.push(context);
    this.patterns.set(key, pattern);

    // Suggest automation after 3+ repetitions
    if (pattern.count >= 3) {
      this.suggestAutomation(url, action, pattern);
    }
  }

  private suggestAutomation(url: string, action: string, pattern: Pattern) {
    // Notify user about detected pattern
    chrome.runtime.sendMessage({
      type: "PATTERN_DETECTED",
      pattern: { url, action, count: pattern.count },
    });
  }
}
```

### 3. Smart Notifications

#### **Add to App.tsx**

```typescript
// Monitor page changes
useEffect(() => {
  const checkForIncompleteForm = async () => {
    const tabs = await chrome.tabs.query({ active: true });
    if (tabs[0]) {
      const result = await chrome.tabs.sendMessage(tabs[0].id, {
        type: "CHECK_FORM_COMPLETE",
      });

      if (result?.incomplete) {
        addSuggestion({
          title: "Incomplete Form Detected",
          description: "Some required fields are empty",
          action: async () => {
            /* highlight fields */
          },
        });
      }
    }
  };

  const interval = setInterval(checkForIncompleteForm, 5000);
  return () => clearInterval(interval);
}, []);
```

---

## **Option C: Polish & Ship** (Priority 3)

### 1. Fix TypeScript Lint Errors

#### **Current Errors:**

1. `background/index.ts` - Message type inference issues
2. `task-scheduler.ts` - Unused variable 'task'
3. Various type mismatches

#### **Fixes:**

**background/index.ts:**

```typescript
// Add proper typing
type BackgroundMessage =
  | { type: "CAPTURE_SCREENSHOT" }
  | { type: "VISUAL_REASONING_FIND_ELEMENT"; description: string; visualContext: any }
  | { type: "TASK_SCHEDULE"; goal: string; priority: TaskPriority; schedule: any }
  | ... // all message types

chrome.runtime.onMessage.addListener((msg: BackgroundMessage, sender, sendResponse) => {
  // Now TypeScript knows the types!
});
```

**task-scheduler.ts:**

```typescript
// Line 194 - Remove unused variable
// Before:
const task = this.queue.splice(taskIndex, 1)[0];
// After:
this.queue.splice(taskIndex, 1)[0]; // If truly unused
```

### 2. Add Comprehensive Tests

#### **File: `tests/enhanced-agent.test.ts`** (NEW)

```typescript
import { createAgent } from "../src/content/enhanced-agent";

describe("EnhancedBrowserAgent", () => {
  it("should navigate to URL", async () => {
    const agent = createAgent();
    await agent.goto("https://example.com");
    expect(await agent.getUrl()).toBe("https://example.com/");
  });

  it("should find element with multiple strategies", async () => {
    const element = await agent.findElement({
      id: "submit",
      css: "button.submit",
    });
    expect(element).toBeTruthy();
  });
});
```

### 3. Create User Documentation

#### **File: `README.md`** (UPDATE)

Add sections:

- Quick Start Guide
- Feature Overview
- API Reference
- Examples
- Troubleshooting

### 4. Prepare for Chrome Web Store

- [ ] Create promotional images (1280x800, 640x400, 440x280)
- [ ] Write compelling description
- [ ] Add privacy policy
- [ ] Test on clean Chrome profile
- [ ] Set up analytics (optional)

---

## **Implementation Order**

### **Week 1: Core Integration**

1. ✅ Day 1: Enhanced Agent integration
2. ✅ Day 2: Task Scheduler UI
3. ✅ Day 3: Agent Coordinator UI
4. ✅ Day 4: Recording Panel
5. ✅ Day 5: Test & fix

### **Week 2: Proactive Features**

6. Day 6: Context suggestions
7. Day 7: Pattern learning
8. Day 8: Smart notifications
9. Day 9: Test & refine

### **Week 3: Polish**

10. Day 10-11: Fix all TypeScript errors
11. Day 12-13: Write tests
12. Day 14: Documentation
13. Day 15: Chrome Web Store prep

---

## **File Structure (After Integration)**

```
src/
├── background/
│   ├── index.ts (updated with all handlers)
│   ├── task-scheduler.ts ✅
│   └── agent-coordinator.ts ✅
├── content/
│   ├── enhanced-agent.ts ✅
│   ├── action-recorder.ts ✅
│   ├── visual-reasoning.ts ✅
│   └── agent.ts (existing)
├── sidepanel/
│   ├── App.tsx (MAJOR UPDATE)
│   ├── components/
│   │   ├── TaskScheduler.tsx ✅
│   │   ├── AgentCoordinator.tsx ✅
│   │   ├── RecordingPanel.tsx (NEW)
│   │   ├── SuggestionCard.tsx (NEW)
│   │   ├── TaskProgress.tsx ✅
│   │   └── VoiceFeedback.tsx ✅
│   └── hooks/
│       ├── useEnhancedAgent.ts (NEW)
│       ├── useTaskScheduler.ts (NEW)
│       └── useProactiveSuggestions.ts (NEW)
└── common/
    ├── proactive-suggestions.ts (NEW)
    ├── pattern-learner.ts (NEW)
    └── ... (existing)
```

---

## **Success Metrics**

### **Functionality:**

- ✅ All features work independently
- ✅ Features work together seamlessly
- ✅ No TypeScript errors
- ✅ No runtime errors
- ✅ Performance is acceptable (<100ms response)

### **Quality:**

- ✅ 90%+ test coverage on new code
- ✅ All lint warnings resolved
- ✅ Documentation complete
- ✅ User testing on 3+ people

### **Ship:**

- ✅ Chrome Web Store listing ready
- ✅ Privacy policy published
- ✅ Support email set up
- ✅ Analytics configured (optional)

---

## **Next Immediate Actions**

1. **High Priority** ✨

   - Update App.tsx with new tabs
   - Create RecordingPanel component
   - Add message handlers to background/index.ts
   - Fix TypeScript errors

2. **Medium Priority** 🔧

   - Implement proactive suggestions
   - Add pattern learning
   - Create tests

3. **Low Priority** 📝
   - Polish documentation
   - Prepare Chrome Web Store assets
   - Set up analytics

**Let's start with High Priority items now!** 🚀
