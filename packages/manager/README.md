# @maschina/manager

The manager's brain: talking to Claude on an owner's own Anthropic key, and the loop that lets it use
tools.

The tools are the whole of what the manager can reach. Whatever service uses this package decides which
tools it gets, so what the manager may see and do is set in code, never by what it is asked.

- `claude(key)` sends one request to Anthropic's Messages API, with the system prompt and tools cached.
- `converse(...)` runs one turn: Claude thinks, calls tools, gets their answers, and replies. It stops
  after eight steps so a confused model cannot loop on the owner's credit.
- `costOf(model, usage)` is what a turn cost in dollars, shown with every answer.
