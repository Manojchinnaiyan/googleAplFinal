# Demo Simulators

Local scripts that synthesize realistic events onto the Pub/Sub bus so the agents
have something to react to during the demo. **Never run these against production.**

Planned:
- `crowd_feed.py` — publishes synthetic `crowd.density` events with a programmable
  stampede-precursor spike (the headline pitch demo).
- `gate_scans.py` — simulates ticket scans across N gates with throughput curves.
- `weather.py` — pushes a rain-front-incoming event mid-match.
