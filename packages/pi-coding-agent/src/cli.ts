#!/usr/bin/env node
/**
 * CLI entry point for the refactored coding agent.
 * Uses main.ts with AgentSession and new mode modules.
 *
 * Test with: npx tsx src/cli-new.ts [args...]
 */
process.title = "pi";

import { setBedrockProviderModule } from "@gsd/pi-ai";
import { bedrockProviderModule } from "@gsd/pi-ai/bedrock-provider";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { main } from "./main.js";

// Node v24 may surface AbortSignal.timeout() abort reasons as uncaught exceptions
// in some call paths. Ensure each timeout signal has an abort listener attached.
const originalAbortSignalTimeout = AbortSignal.timeout.bind(AbortSignal);
AbortSignal.timeout = ((delay: number) => {
	const signal = originalAbortSignalTimeout(delay);
	signal.addEventListener("abort", () => {
		void signal.reason;
	}, { once: true });
	return signal;
}) as typeof AbortSignal.timeout;

setGlobalDispatcher(new EnvHttpProxyAgent());
setBedrockProviderModule(bedrockProviderModule);

main(process.argv.slice(2));
