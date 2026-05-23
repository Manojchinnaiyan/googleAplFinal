# Agents

One folder per ADK agent. Each is an independently deployable Cloud Run service.

## Layout (per agent)
```
agents/<name>/
  agent.py         # ADK Agent definition + tools
  main.py          # FastAPI app: /health, /invoke, Pub/Sub push handler
  pyproject.toml   # deps; uses ../../shared as editable install
  Dockerfile       # python:3.11-slim
  README.md        # what topics this agent reads/writes
```

## The Rule
Every meaningful agent action **must** call `write_decision(AgentDecision(...))` from
`stadiumos_shared.firestore`. This is what the dashboard renders. Skip it and your
agent is invisible to the demo.

## Creating a new agent
Use the `/new-agent` Claude command, or copy the `commander` folder as a template.
