# Project Agent Rules & Slash Actions

## Slash Command: /nemotron
Whenever the user types `/nemotron` or asks to consult Nemotron:
1. Invoke the `nemotron-advisor` skill.
2. Run `python "C:\Users\SUJAY\.gemini\config\skills\nemotron-advisor\scripts\query_nemotron.py"` against the target file or query.
3. Review Nemotron's high-level recommendations and apply approved code refactoring directly to the workspace.
