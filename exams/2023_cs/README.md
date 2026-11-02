# GATE 2023 CS Dataset

- **Paper**: Computer Science & Information Technology (CS)
- **Year**: 2023
- **Organizer**: IIT Kanpur
- **Questions**: 65 | **Marks**: 100

## Special cases
- Q2: Marks To All (MTA)
- Q27: alternate accepted answers
- Q30: dual NAT ranges (2 or 4)

## Files
- `questions.json` — frontend-safe
- `answers.json` — official key + marking
- `assets/` — tightly cropped figures and image-based options

Every question includes a 1-based `source_page` pointing to its page in the question PDF. Question figures are referenced from `questions.json`; image-based options are referenced from `answers.json` with `assets_for_options: true`.

## Formatting
- Mathematical notation uses LaTeX where it improves clarity.
- Tabular data uses structured `headers` and `rows`.
- Code and SQL use fenced code blocks.

## Sources
- Question paper: `../../2023_CS.pdf`
- Answer key: `../../2023_CS_ANS_GATE2023.pdf`
