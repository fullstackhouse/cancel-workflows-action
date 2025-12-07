import * as core from "@actions/core";
import * as github from "@actions/github";

type WorkflowRunStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "waiting"
  | "requested"
  | "pending";

async function run(): Promise<void> {
  try {
    const token = core.getInput("token", { required: true });
    const octokit = github.getOctokit(token);

    const repository = core.getInput("repository") || github.context.repo.owner + "/" + github.context.repo.repo;
    const [owner, repo] = repository.split("/");

    const branch = await resolveBranch(octokit, owner, repo);
    if (!branch) {
      core.info("Could not determine branch, skipping workflow cancellation");
      core.setOutput("cancelled-count", 0);
      return;
    }

    const workflows = parseCommaSeparated(core.getInput("workflows"));
    const statuses = parseCommaSeparated(core.getInput("statuses") || "in_progress,queued") as WorkflowRunStatus[];

    core.info(`Cancelling workflows for branch: ${branch}`);
    if (workflows.length > 0) {
      core.info(`Filtering by workflows: ${workflows.join(", ")}`);
    }
    core.info(`Filtering by statuses: ${statuses.join(", ")}`);

    const currentRunId = github.context.runId;
    const runs = await fetchWorkflowRuns(octokit, owner, repo, branch, statuses, workflows, currentRunId);
    core.info(`Found ${runs.length} workflow run(s) to cancel`);

    let cancelledCount = 0;
    for (const run of runs) {
      try {
        await octokit.rest.actions.cancelWorkflowRun({
          owner,
          repo,
          run_id: run.id,
        });
        core.info(`Cancelled: ${run.name} (#${run.run_number})`);
        cancelledCount++;
      } catch (error) {
        core.warning(`Failed to cancel run ${run.id}: ${error}`);
      }
    }

    core.info(`Successfully cancelled ${cancelledCount} workflow run(s)`);
    core.setOutput("cancelled-count", cancelledCount);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

async function resolveBranch(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string
): Promise<string | null> {
  const branchInput = core.getInput("branch");
  if (branchInput) {
    return branchInput;
  }

  const prNumber = core.getInput("pr-number");
  if (prNumber) {
    try {
      const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: parseInt(prNumber, 10),
      });
      return pr.head.ref;
    } catch (error) {
      core.warning(`Failed to fetch PR #${prNumber}: ${error}`);
      return null;
    }
  }

  const context = github.context;
  if (context.payload.pull_request?.head?.ref) {
    return context.payload.pull_request.head.ref;
  }

  return null;
}

interface WorkflowRun {
  id: number;
  name: string;
  run_number: number;
}

async function fetchWorkflowRuns(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  branch: string,
  statuses: WorkflowRunStatus[],
  workflows: string[],
  excludeRunId: number
): Promise<WorkflowRun[]> {
  const allRuns: WorkflowRun[] = [];

  for (const status of statuses) {
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      branch,
      status,
      per_page: 100,
    });

    for (const run of data.workflow_runs) {
      if (run.id === excludeRunId) {
        continue;
      }
      const name = run.name ?? "Unknown";
      const matchesWorkflow = workflows.length === 0 || workflows.some((w) => name === w);
      if (matchesWorkflow) {
        allRuns.push({ id: run.id, name, run_number: run.run_number });
      }
    }
  }

  const uniqueRuns = new Map<number, WorkflowRun>();
  for (const run of allRuns) {
    uniqueRuns.set(run.id, run);
  }

  return Array.from(uniqueRuns.values());
}

function parseCommaSeparated(input: string): string[] {
  if (!input.trim()) {
    return [];
  }
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

run();
