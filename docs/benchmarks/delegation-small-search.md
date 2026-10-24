# Delegation on a small search (measured)

**Question:** for a read-only "find everything about X" task in a small repo, does handing the search to a sub-agent (the kit's `explorer`) keep the main conversation smaller and the answer as good?

**Setup.** Repo: this kit (about 200 files). Model: `sonnet`. Three runs per arm, interleaved, each a fresh `claude -p` session. Arm A: no plugin, Agent tool disabled, the main agent searches itself. Arm B: the kit as a plugin, prompt tells the main agent to use the `explorer` sub-agent and read only its report. Same task text. Score = how many of 8 files that must appear in the answer did appear. Numbers come from the session transcripts (`scripts/session-stats.js`). Harness: `scripts/bench-delegation.js`. Raw rows: [delegation-small-search.raw.json](delegation-small-search.raw.json).

| Median of 3 | A: no sub-agent | B: explorer sub-agent |
|---|---|---|
| Main conversation, peak context | 32.5k | 31.9k |
| Fresh tokens, main conversation | 9.4k | 19.2k |
| Fresh tokens, sub-agent | 0 | 34.8k to 47.7k |
| Fresh tokens, total | 9.4k | 63.4k |
| Wall time | 19 s | 78 s |
| Cost | $0.07 | $0.21 |
| Answer score (of 8) | 8, 8, 8 | 8, 7, 8 |

**Result.** On this task delegation did not help and cost about 6.7 times the tokens, 4 times the time and 3 times the money. The main context peak did not drop because it is dominated by a fixed ~30k of system prompt and tool definitions, and the search itself was small enough (`git grep` answered in a few calls) that it never filled the main context. One of three delegated answers missed a file.

**What it does not show.** One task, one repo, one model, three runs: treat it as a data point, not a law. It says nothing about large monorepos, searches that need dozens of file reads, or parallel writers, which is where delegation is meant to pay. A run on such a task is the most useful result anyone could add (see [../BENCHMARK.md](../BENCHMARK.md)).

**What the kit did with it.** The `delegate` skill now says: do the search yourself when `git grep` answers it in one or two calls; delegate when the search would read many files or the output would flood the context.
