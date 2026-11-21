# Provenance log

`provenance/log.jsonl` records where every CalcGym artifact came from: rule tables, checkers,
oracles, source notes and tasks. One JSON object per line.

## Rules for the log

- Append only. Existing lines are never edited or deleted. `src/provenance.ts` (`appendEntry`)
  refuses to log an id twice with different content; a changed artifact gets a new versioned id
  (for example `checker:gst_hst@v2`), and the old line stays.
- Every entry carries a `sha256` of the artifact (the file, or for a task its JSONL line), so a
  buyer can check that the delivered artifact is the one that was logged.
- Times are ISO 8601 in America/Toronto with the offset, e.g. `2026-11-20T23:40:12-05:00`.

## Source boundary

Everything in CalcGym comes from public sources or original work, nothing from Anthony's time
at Google. Every provenance log entry must include: source (URL or "original"), author (person
or open-weight model name; for deterministic templates record the template id and "CalcGym
template, written by CalcGym agent"), and date. If a task can't be tied to a public source or
written from scratch, drop it.

## Generation rule for sellable tasks

Sellable tasks are generated only with open-weight models or deterministic templates, never
with Anthropic or OpenAI outputs. v0 uses deterministic templates only (`generator.model` is
`null` on every task). If an open-weight model is used later, `generator` must record the model
name, exact version or weights hash, and the prompt template id, and `author` must name the model.

## Schema

| field | type | meaning |
|---|---|---|
| `id` | string | Unique id: `rule:<name>@vN`, `checker:<name>@vN`, `oracle:<name>@vN`, `source:<name>@vN`, `task:<set>:<checker>:<NNNN>` |
| `kind` | string | `rule_table`, `checker`, `oracle`, `test`, `source_notes`, `generator`, `task` |
| `path` | string | Repo path of the artifact |
| `sha256` | string | Hash of the artifact file, or of the task's JSONL line |
| `created_at` | string | When the entry was written, America/Toronto, with offset (this is the entry date) |
| `author` | string | Person, open-weight model name, or for templates "CalcGym template, written by CalcGym agent (template &lt;id&gt;)". Code and rule files written by the build agent say "CalcGym agent (Grok Bot build agent), original work" |
| `source` | list | Each item is one of: `{type:"url", url, retrieved}` (public page and date fetched), `{type:"toolsloft", path, commit}` (Anthony's own public Toolsloft code the checker was adapted from), `{type:"rules", id}`, `{type:"original"}` |
| `generator` | object | `{type:"deterministic_template", template_id, seed, prng, script, model:null}` for tasks; `{type:"hand_written", model:null}` for code and rule tables |
| `human_review` | object | `{status: "pending" or "approved" or "rejected", reviewer, reviewed_at}`. Review results are appended as new lines with `kind:"review"` and `subject_id`, never by editing the original line |
| `license` | string | License or rights note |
| `source_boundary` | string | Always "public sources and original work only" |
| `notes` | string, optional | Anything a reviewer should know (scope limits, unverified items) |

## Files

- `log.jsonl`: the log.
- `sources/SOURCES.md`: the figures quoted from each fetched public page, with URL and date.
