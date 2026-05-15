import { isAbsolute, relative, resolve } from "node:path";
import { normalizePlannedFileReference } from "./files.js";

export interface PlanningPathScopeField {
  field: string;
  values: string[];
}

function isInsideBase(basePath: string, candidate: string): boolean {
  const base = resolve(basePath);
  const abs = resolve(candidate);
  const rel = relative(base, abs);
  return rel === "" || (!!rel && !rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Planning IO fields are execution contracts. Absolute paths are only safe when
 * they stay inside the active working directory; in worktree mode, an absolute
 * path to the original checkout makes executors edit the wrong tree.
 */
export function validatePlanningPathScope(
  basePath: string,
  fields: PlanningPathScopeField[],
  allowedAbsoluteRoots?: readonly string[] | ReadonlySet<string>,
): string | null {
  const allowedRoots = allowedAbsoluteRoots
    ? Array.from(allowedAbsoluteRoots, (root) => resolve(root))
    : [resolve(basePath)];

  for (const { field, values } of fields) {
    for (const raw of values) {
      const candidate = normalizePlannedFileReference(raw);
      if (!isAbsolute(candidate)) continue;
      if (allowedRoots.some((root) => isInsideBase(root, candidate))) continue;
      return `${field} contains absolute path outside allowed roots: ${candidate}. Use a path relative to one of: ${allowedRoots.join(", ")}.`;
    }
  }

  return null;
}
