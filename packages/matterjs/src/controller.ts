import { CommissioningController } from '@project-chip/matter.js';
import { createAgapiMatterEnvironment } from './environment.js';

export interface AgapiMatterControllerOptions {
  /** Unique id for this controller instance (its storage/data namespace). */
  id: string;
  /** Shown to commissioned devices as the fabric admin label (max 32 chars). */
  label: string;
  /** Persist fabric/commissioned-node state to agapi.fs. Default true. */
  persistent?: boolean;
}

/**
 * Creates and starts a `CommissioningController` wired to the agapi/Tauri
 * environment (only `Network` needs an adapter — see environment.ts).
 *
 * `autoConnect: false` — this only discovers/commissions on start; it
 * doesn't proactively reconnect to previously-paired nodes. That's unrelated
 * to persistence: `getCommissionedNodesDetails()` still lists nodes loaded
 * from `agapi.fs`-backed storage regardless — `getNode()`/`removeNode()`
 * connect on demand.
 */
export async function createAgapiMatterController(
  options: AgapiMatterControllerOptions,
): Promise<CommissioningController> {
  const environment = createAgapiMatterEnvironment({ persistent: options.persistent });

  const controller = new CommissioningController({
    environment: { environment, id: options.id },
    adminFabricLabel: options.label,
    autoConnect: false,
  });

  try {
    await controller.start();
  } catch (e) {
    // A failed start() can still leave sockets/endpoints partially up.
    // controllerRef in the caller never gets set on failure, so without
    // this the resources leak until the whole webview reloads.
    await controller.close().catch(() => {});
    throw e;
  }

  return controller;
}
