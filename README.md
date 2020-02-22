# pull-0x-api-reverts
Pull 0x-api revert traces from Google BigQuery and parse out useful information from the callgraph.

See sample output at: https://gist.github.com/dorothy-zbornak/27850ccecec81eeeea106dab947dc06d

## Setup
- Generate a credentials file from google cloud and save it to `credentials.json` in the root directory.
- `yarn`
- `yarn fetch`
