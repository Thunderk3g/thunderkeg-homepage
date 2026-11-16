import { isLlmConfigured } from '@/os/ai/llm';
import { hostedEngine, publicConfig, steerFile, steerModels } from '@/steer/server/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What the canvas needs before it can start: the dials and tasks from
 * steering/dimensions.yaml, the simulated writer's material, and whether a
 * model is configured here (without one the canvas runs simulated, and says so).
 */
export async function GET() {
  const llm = isLlmConfigured();
  return Response.json(
    {
      ...publicConfig(steerFile()),
      llm,
      model: llm ? steerModels()[0] : null,
      engine: hostedEngine(),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
