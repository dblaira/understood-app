# Understood Agent Instructions

This repository backs the app surface currently associated with Vercel project `news-journal-app`, including `lab.understood.app`, `understood.sh`, and `www.understood.sh`.

Reference `WORKING_PATTERNS.md` when available. Start by deciding whether the request is Phase 1 ("help me judge this") or Phase 2 ("execute requirements"). If the task touches visible product behavior, wording, visual design, recommendations, ontology, knowledge graph, or agent communication, apply the strategy below before making decisions.

## Latest Strategy: June 13, 2026

This app is being built for me. I am the first user but hopefully not the last. Anything that doesn't resonate with me is useless or worse -- destructive. My taste and natural reaction to any wording, component, functionality, API call, font size, color scheme, recommendation engine, ontology, knowledge graph, and any other detail should use only my judgement as the bar of success. This means that anything I don't understand, when communicating with an agent is potentially harmful to the project. That said, if I want to add something just because it is a good idea and is there for others, that is fine too. But always. Always, the app is being designed solely for me.

## Operating Rule

Do not optimize Understood for a hypothetical average user before Adam has reacted to it. Adam's understanding, taste, and natural response are the acceptance criteria. If Adam does not understand the agent's explanation, naming, or proposed implementation, treat that as a product risk, not a communication footnote.

## How agents use Adam's Macs (required)

Adam signed up for Tailscale so agents work **on his real computers** — the ones already signed into his accounts — not on a blank rented machine that has to fight every login.

**Default rule:** Do the work on his Macs. Prefer `studio` (Mac Studio). Use `mbp` or `mbp2` when the task belongs there.

When Tailscale is joined (secrets `TAILSCALE_AUTHKEY` + `TAILSCALE_SSH_KEY`):
- `ssh studio` — Mac Studio — primary
- `ssh mbp` — MacBook Pro
- `ssh mbp2` — MacBook Pro 2

**Do not say you cannot access his files, apps, builds, or signed-in sessions** without first trying his Macs. If a website or app needs a login, do it from his Mac (already trusted), not from the cloud box.

If Tailscale is not joined yet, run: `bash .cursor/tailscale-join.sh`


## Skills to load (do not skip)

Always: requirement-is-the-test, adams-words, no-time-estimates, cognitive-fit, articulate-leadership-communication.

Stack (when editing matching files): see `.cursor/rules/stack-*.mdc` — nextjs / react-best-practices / figma-swiftui / aws-lambda / context7 / systematic-debugging.

If the same mistake happens twice: create a rule. Prefer system over apology.

