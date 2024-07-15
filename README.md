# glean-collections-sync

<!-- action-docs-description source="action.yml" -->
## Description

Automatic syncing of search results into a collection in Glean
<!-- action-docs-description source="action.yml" -->

## Usage

Create a new file called `.github/workflows/glean-collections-sync.yml` in your repository with the following contents:

```yaml
name: Sync Collections

on:
  schedule:
    - cron: '0 0 * * *' # Runs every day at midnight UTC
  workflow_dispatch: # Allows for manual triggering

jobs:
  sync_collections:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Sync collections
        uses: scalvert/glean-collections-sync@v1
        with:
          collection_name: 'your-collection-name'
          query: 'your-query'
          filters: 'your-filters'
```

<!-- action-docs-inputs source="action.yml" -->
## Inputs

| name | description | required | default |
| --- | --- | --- | --- |
| `glean-client-api-url` | <p>Glean client API URL</p> | `true` | `""` |
| `glean-client-api-token` | <p>Glean client API token</p> | `true` | `""` |
| `glean-user-email` | <p>Glean user email on whose behalf the request is intended to be made</p> | `true` | `""` |
| `collection-name` | <p>Name of the collection</p> | `true` | `""` |
| `query` | <p>Search query</p> | `false` | `""` |
| `filters` | <p>Search filters</p> | `false` | `""` |
<!-- action-docs-inputs source="action.yml" -->

<!-- action-docs-outputs source="action.yml" -->
## Outputs

| name | description |
| --- | --- |
| `result` | <p>Result of the sync operation</p> |
<!-- action-docs-outputs source="action.yml" -->

<!-- action-docs-runs source="action.yml" -->
## Runs

This action is a `node20` action.
<!-- action-docs-runs source="action.yml" -->
