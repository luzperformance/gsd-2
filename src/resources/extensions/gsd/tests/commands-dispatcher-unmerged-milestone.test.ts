// Project/App: GSD-2
// File Purpose: Dispatcher regression tests for completed-but-unmerged milestone branches.

import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { handleGSDCommand } from "../commands/dispatcher.ts";
import {
  closeDatabase,
  insertMilestone,
  openDatabase,
} from "../gsd-db.ts";
import { invalidateStateCache } from "../state.ts";
import { cleanup, git, makeTempRepo } from "./test-utils.ts";

interface NotifyCall {
  message: string;
  kind: string;
}

interface SentMessage {
  customType: string;
  content: string;
  display: boolean;
}

function makeMockCtx(base: string): {
  ctx: any;
  calls: NotifyCall[];
  widgets: Array<[string, unknown]>;
  statuses: Array<[string, string | undefined]>;
} {
  const calls: NotifyCall[] = [];
  const widgets: Array<[string, unknown]> = [];
  const statuses: Array<[string, string | undefined]> = [];
  return {
    ctx: {
      cwd: base,
      ui: {
        notify: (message: string, kind: string) => {
          calls.push({ message, kind });
        },
        setWidget: (key: string, value: unknown) => {
          widgets.push([key, value]);
        },
        setStatus: (key: string, value: string | undefined) => {
          statuses.push([key, value]);
        },
      },
    },
    calls,
    widgets,
    statuses,
  };
}

function makeMockPi(): { pi: any; messages: SentMessage[] } {
  const messages: SentMessage[] = [];
  return {
    pi: {
      sendMessage: (message: SentMessage) => {
        messages.push(message);
      },
    },
    messages,
  };
}

function seedCompletedUnmergedMilestone(base: string): void {
  mkdirSync(join(base, ".gsd"), { recursive: true });
  openDatabase(join(base, ".gsd", "gsd.db"));
  insertMilestone({ id: "M008", title: "Live Text Search", status: "complete" });

  git(base, "checkout", "-b", "milestone/M008");
  const implementationFile = join(base, "index.html");
  mkdirSync(dirname(implementationFile), { recursive: true });
  writeFileSync(implementationFile, "<h1>M008</h1>\n");
  git(base, "add", "index.html");
  git(base, "commit", "-m", "feat: live text search");
  git(base, "checkout", "main");
  invalidateStateCache();
}

test("dispatcher blocks bare /gsd when a completed milestone branch is unmerged", async () => {
  const base = makeTempRepo("gsd-dispatch-unmerged-");
  try {
    seedCompletedUnmergedMilestone(base);
    const { ctx, calls, widgets, statuses } = makeMockCtx(base);
    const { pi, messages } = makeMockPi();

    await handleGSDCommand("", ctx, pi);

    assert.equal(calls.length, 0);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].customType, "gsd-command-block");
    assert.equal(messages[0].display, true);
    assert.match(messages[0].content, /\/gsd cannot start new workflow work/);
    assert.match(messages[0].content, /M008 is complete but not merged/);
    assert.match(messages[0].content, /index\.html/);
    assert.ok(widgets.some(([key, value]) => key === "gsd-outcome" && value === undefined));
    assert.ok(widgets.some(([key, value]) => key === "gsd-progress" && value === undefined));
    assert.ok(statuses.some(([key, value]) => key === "gsd-step" && value === undefined));
  } finally {
    closeDatabase();
    invalidateStateCache();
    cleanup(base);
  }
});

test("dispatcher blocks workflow-advancing commands while completed branch is unmerged", async () => {
  const blockedCommands = ["auto", "next", "start", "discuss", "do mark all complete"];

  for (const command of blockedCommands) {
    const base = makeTempRepo("gsd-dispatch-unmerged-");
    try {
      seedCompletedUnmergedMilestone(base);
      const { ctx, calls } = makeMockCtx(base);
      const { pi, messages } = makeMockPi();

      await handleGSDCommand(command, ctx, pi);

      assert.equal(calls.length, 0, command);
      assert.equal(messages.length, 1, command);
      assert.equal(messages[0].display, true, command);
      assert.match(messages[0].content, /cannot start new workflow work/, command);
    } finally {
      closeDatabase();
      invalidateStateCache();
      cleanup(base);
    }
  }
});
