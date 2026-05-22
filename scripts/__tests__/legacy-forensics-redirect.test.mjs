// Project/App: GSD-2
// File Purpose: Regression tests for closing legacy /gsd forensics issues with an Open GSD redirect.

import assert from "node:assert/strict";
import test from "node:test";

import {
  FORENSICS_MARKER,
  OPEN_GSD_ISSUES_URL,
  REDIRECT_MARKER,
  buildRedirectComment,
  hasRedirectComment,
  isLegacyForensicsIssue,
  redirectLegacyForensicsIssue,
} from "../legacy-forensics-redirect.mjs";

test("isLegacyForensicsIssue only matches issue bodies created by /gsd forensics", () => {
  assert.equal(isLegacyForensicsIssue({ body: `details\n${FORENSICS_MARKER}` }), true);
  assert.equal(isLegacyForensicsIssue({ body: "ordinary bug report" }), false);
  assert.equal(isLegacyForensicsIssue({ body: FORENSICS_MARKER, pull_request: {} }), false);
});

test("buildRedirectComment points reporters to the active Open GSD issue tracker", () => {
  const comment = buildRedirectComment();

  assert.match(comment, new RegExp(REDIRECT_MARKER));
  assert.match(comment, new RegExp(OPEN_GSD_ISSUES_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(comment, /retired repository/);
});

test("hasRedirectComment prevents duplicate redirect comments", () => {
  assert.equal(hasRedirectComment([{ body: `${REDIRECT_MARKER}\nAlready handled.` }]), true);
  assert.equal(hasRedirectComment([{ body: "ordinary comment" }]), false);
});

test("redirectLegacyForensicsIssue comments once and closes open forensics issues", async () => {
  const calls = [];
  const githubJson = async (path, options = {}) => {
    calls.push({ path, options });
    if (path.endsWith("/comments?per_page=100")) return [];
    return {};
  };

  const result = await redirectLegacyForensicsIssue(githubJson, "gsd-build", "gsd-2", {
    number: 42,
    state: "open",
    body: `Report\n${FORENSICS_MARKER}`,
  });

  assert.equal(result, "redirected");
  assert.deepEqual(
    calls.map((call) => [call.path, call.options.method || "GET"]),
    [
      ["/repos/gsd-build/gsd-2/issues/42/comments?per_page=100", "GET"],
      ["/repos/gsd-build/gsd-2/issues/42/comments", "POST"],
      ["/repos/gsd-build/gsd-2/issues/42", "PATCH"],
    ],
  );
  assert.match(JSON.parse(calls[1].options.body).body, /open-gsd\/gsd-pi\/issues/);
  assert.deepEqual(JSON.parse(calls[2].options.body), { state: "closed", state_reason: "not_planned" });
});

test("redirectLegacyForensicsIssue does not duplicate comments or close already closed issues", async () => {
  const calls = [];
  const githubJson = async (path, options = {}) => {
    calls.push({ path, options });
    if (path.endsWith("/comments?per_page=100")) return [{ body: REDIRECT_MARKER }];
    return {};
  };

  const result = await redirectLegacyForensicsIssue(githubJson, "gsd-build", "gsd-2", {
    number: 42,
    state: "closed",
    body: FORENSICS_MARKER,
  });

  assert.equal(result, "redirected");
  assert.deepEqual(calls.map((call) => call.options.method || "GET"), ["GET"]);
});

test("redirectLegacyForensicsIssue skips non-forensics issues", async () => {
  const calls = [];
  const result = await redirectLegacyForensicsIssue(
    async (path, options) => {
      calls.push({ path, options });
      return {};
    },
    "gsd-build",
    "gsd-2",
    { number: 42, state: "open", body: "ordinary bug" },
  );

  assert.equal(result, "skipped");
  assert.deepEqual(calls, []);
});
