# IncidentRecorder domain knowledge reference

IncidentRecorder v2.8 uses two team-provided reference sources to improve analysis quality:

1. **KeepStock glossary** - curated into conservative terminology normalization, Deepgram keyterms, caller-role interpretation, and the Workers AI domain glossary.
2. **Historical ServiceNow ticket export** - reviewed as a representative, cross-category sample to identify strong documentation patterns. No customer-specific names, email addresses, account data, ticket numbers, or raw historical ticket text are bundled into IncidentRecorder.

## How historical tickets are used

Historical tickets are **style references only**. They teach the analyzer to preserve granular troubleshooting actions and use KeepStock terminology consistently. They never become evidence for a current incident.

The v2.8 reference patterns cover examples such as:

- MobileCast login guidance with separate Device ID / RACK ID / password instructions.
- MRF and PRF fulfillment without claiming the requested maintenance or data change already occurred.
- Network diagnostics with commands and results kept as distinct steps.
- Machine/COM troubleshooting with configuration changes, cable moves, power cycles, and initialization results kept in order.
- Item-data training where the lookup, finding, deletion, reboot, and retest are each retained.

## Source-of-truth rule

For every generated ticket, the current Rough Notes remain the only source of truth for current-incident facts. Glossary definitions and historical examples may influence terminology and documentation style, but they must never add a current action, result, identifier, or resolution that the current Rough Notes do not support.
