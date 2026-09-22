import 'dotenv/config';
import { processPendingContractDeliveries } from '../services/contract-delivery-worker.service.js';

async function main() {
  try {
    const result = await processPendingContractDeliveries();

    console.log(JSON.stringify({
      success: true,
      processed: result.processed,
      results: result.results
    }, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Contract delivery worker failed:', error);
    process.exit(1);
  }
}

main();
