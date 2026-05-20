# Tennis Ontology Mini Lab

This is a small, playful ontology project for learning Protégé, RDF/Turtle, SPARQL, SHACL, and Docker.

The core loop is:

1. Ask competency questions in plain English.
2. Model the tennis world in Protégé.
3. Save the ontology as Turtle.
4. Load it into a Dockerized SPARQL server.
5. Query it and see whether the model answers the questions.

## Files

- `tennis.ttl`: the ontology you can open in Protégé.
- `shapes.ttl`: lightweight SHACL checks for player/match data quality.
- `queries/*.rq`: small SPARQL questions to run in Fuseki.
- `docker-compose.yml`: runs Apache Jena Fuseki locally.

## Competency Questions

These are the first artifact. The ontology is only "good" if it can answer questions like these:

1. Which players use a one-handed backhand?
2. Which players prefer baseline rallies?
3. Which matches were played on clay?
4. Which players won a Grand Slam final?
5. Which players are good fits for a clay-court baseline strategy?
6. Which rivalries involve players with different playing styles?

## Open In Protégé

1. Open Protégé.
2. Choose `File` -> `Open...`.
3. Select `tennis.ttl`.
4. In the `Entities` tab, inspect:
   - Classes: `Player`, `Tournament`, `Match`, `Surface`, `PlayingStyle`, `Stroke`
   - Object properties: `usesStroke`, `prefersSurface`, `hasPlayingStyle`, `winnerOf`
   - Individuals: `rafael-nadal`, `roger-federer`, `serena-williams`, `iga-swiatek`
5. Try adding yourself as a new player.

## Run The Docker SPARQL Playground

From this folder:

```bash
docker compose up -d
```

Then open:

```text
http://localhost:3030
```

The dataset name is `tennis`.

To load the ontology, use Fuseki's upload UI:

1. Open `http://localhost:3030`.
2. Choose the `tennis` dataset.
3. Go to `upload data`.
4. Upload `tennis.ttl`.
5. Run queries from the `queries` folder.

Or load it from the terminal:

```bash
./load-tennis-data.sh
```

Then run a query from the terminal:

```bash
curl -H 'Accept: text/csv' \
  --data-urlencode query@queries/01-one-handed-backhand.rq \
  http://localhost:3030/tennis/query
```

To stop it:

```bash
docker compose down
```

## Tiny Project Ideas

### Project 1: Tennis Style Finder

Add five players you like and model:

- backhand type
- favorite surface
- style
- signature stroke

Then query: "Who plays like Rafael Nadal?"

### Project 2: Match Explainer

Add a match with:

- winner
- loser
- surface
- tournament
- score

Then query: "What facts explain why this match belongs to a clay-court rivalry?"

### Project 3: Understood-Style Trust Boundary

Add two statuses:

- `CandidateFact`
- `ConfirmedFact`

Then practice the key Understood idea: only confirmed facts should be used in answers.
