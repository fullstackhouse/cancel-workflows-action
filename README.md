# Cancel Workflows Action

A GitHub Action to cancel running or queued workflows for a branch or PR. Useful for cleaning up workflows when a PR is closed.

## Usage

### Cancel workflows when PR is closed

```yaml
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      actions: write
      pull-requests: read
    steps:
      - uses: fullstackhouse/cancel-workflows-action@v1
        with:
          token: ${{ github.token }}
```

### Cancel specific workflows

```yaml
- uses: fullstackhouse/cancel-workflows-action@v1
  with:
    token: ${{ github.token }}
    workflows: "Test,Deploy preview"
```

### Cancel workflows for a specific branch

```yaml
- uses: fullstackhouse/cancel-workflows-action@v1
  with:
    token: ${{ github.token }}
    branch: feature/my-branch
```

### Cancel workflows for a PR by number

```yaml
- uses: fullstackhouse/cancel-workflows-action@v1
  with:
    token: ${{ github.token }}
    pr-number: "123"
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `token` | Yes | - | GitHub token with `actions: write` permission |
| `branch` | No | PR head branch | Branch to cancel workflows for |
| `pr-number` | No | - | PR number (used to lookup branch if branch not provided) |
| `repository` | No | Current repo | Target repository (owner/repo) |
| `workflows` | No | All | Comma-separated workflow names to cancel |
| `statuses` | No | `in_progress,queued` | Comma-separated statuses to cancel |

## Outputs

| Output | Description |
|--------|-------------|
| `cancelled-count` | Number of workflow runs cancelled |

## Permissions

This action requires the following permissions:

```yaml
permissions:
  actions: write       # Required to cancel workflows
  pull-requests: read  # Required if using pr-number input
```

## Branch Resolution

The action determines which branch to cancel workflows for in this order:

1. `branch` input (if provided)
2. `pr-number` input (looks up the PR's head branch)
3. `github.context.payload.pull_request.head.ref` (from PR event context)

## License

MIT
