// the RPC Nodes holds the data,
// all other nodes get deleted the caches.

import { NodeManager } from '../net/nodeManager';

const nodeManager = NodeManager.get();

nodeManager.nodeStates.forEach(async (s) => {
  if (s.nodeID > 0) {
    await s.clearDBLocal();
  }
});
